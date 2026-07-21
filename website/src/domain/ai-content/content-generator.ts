/**
 * AI Content Generator
 *
 * Orchestrates:
 *   1. Read the Excel workbook
 *   2. Extract structured data
 *   3. Build the generation prompt
 *   4. Call OpenAI to generate Business Review + Executive Summary
 *   5. Parse the AI response
 *   6. Save results to the database (knowledge_snippets + business_review_parts)
 *
 * Reports progress at each stage via an optional callback so callers can
 * surface real-time status (SSE, progress bars, notifications).
 *
 * This eliminates the need for manual Markdown file uploads.
 */

import { extractExcelData } from '@/domain/excel/excel-extractor';
import { buildGenerationPrompt } from '@/domain/ai-content/prompt-builder';
import { resolveOpenAiKey } from '@/lib/openai';
import type { DbClient } from '@/lib/db';

// ── Progress reporting ──────────────────────────────────

export type ProgressStep =
  | 'extracting'
  | 'prompt'
  | 'openai'
  | 'parsing'
  | 'saving'
  | 'saving_exec'
  | 'complete'
  | 'error';

export interface ProgressEvent {
  /** Machine-readable step identifier */
  step: ProgressStep;
  /** Human-readable status message shown in the UI notification bar */
  message: string;
  /** Estimated completion percentage 0–100 */
  pct: number;
  /** Optional detail payload (result on 'complete', error info on 'error') */
  detail?: unknown;
}

export type ProgressCallback = (event: ProgressEvent) => void;

// ── Types ──────────────────────────────────────────────

export interface AiGeneratedContent {
  businessReview: string;
  executiveSummary: string;
  promptLength: number;
  responseLength: number;
  model: string;
}

export interface GenerationResult {
  success: boolean;
  content?: AiGeneratedContent;
  error?: string;
}

export interface SavedResult {
  businessReviewParts: { slug: string; title: string }[];
  executiveSummarySaved: boolean;
}

// ── AI Call ─────────────────────────────────────────────

async function callOpenAi(
  prompt: string,
  apiKey: string,
  model = 'gpt-4o',
  onProgress?: ProgressCallback,
): Promise<AiGeneratedContent> {
  onProgress?.({
    step: 'openai',
    message: `Calling OpenAI (${model}) — this may take 30–60 seconds...`,
    pct: 40,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a precise financial analyst and business writer. You ALWAYS return only valid JSON with exactly the keys requested. You never include explanatory text outside the JSON.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 16000,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API error (${response.status}): ${errBody}`);
  }

  onProgress?.({
    step: 'openai',
    message: 'OpenAI response received — parsing JSON...',
    pct: 60,
  });

  const result = await response.json();
  const reply = result.choices?.[0]?.message?.content ?? '';

  // Parse the JSON response
  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(reply);
  } catch {
    // Try to extract JSON from the response if wrapped in markdown code fences
    const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error(
        'AI response was not valid JSON. Raw response: ' + reply.slice(0, 500),
      );
    }
  }

  return {
    businessReview: parsed.businessReview ?? '',
    executiveSummary: parsed.executiveSummary ?? '',
    promptLength: prompt.length,
    responseLength: reply.length,
    model,
  };
}

// ── Content parsing helpers ─────────────────────────────

interface ReviewPart {
  slug: string;
  partKey: string;
  title: string;
  sortOrder: number;
  markdown: string;
}

/**
 * Parse the Business Review markdown into part-based sections.
 * Splits on ## Part X: or ### Part X: headers.
 */
function parseReviewParts(markdown: string): ReviewPart[] {
  const parts: ReviewPart[] = [];
  // Match headers like: ## Part A: ... or ### Part A: ...
  const partRegex = /^#{1,3}\s+(Part\s+([A-Z]):\s*(.+))/gm;
  const matches: {
    index: number;
    fullMatch: string;
    partKey: string;
    title: string;
  }[] = [];

  let match;
  while ((match = partRegex.exec(markdown)) !== null) {
    matches.push({
      index: match.index,
      fullMatch: match[0],
      partKey: match[2],
      title: match[1].trim(),
    });
  }

  // If no parts found, create one default part
  if (matches.length === 0) {
    parts.push({
      slug: 'part-a',
      partKey: 'A',
      title: 'Part A: Business Review',
      sortOrder: 0,
      markdown: markdown,
    });
    return parts;
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startIdx = current.index;
    const endIdx = next ? next.index : markdown.length;
    const sectionContent = markdown.slice(startIdx, endIdx).trim();

    const slug = `part-${current.partKey.toLowerCase()}`;
    parts.push({
      slug,
      partKey: current.partKey,
      title: current.title,
      sortOrder: i,
      markdown: sectionContent,
    });
  }

  return parts;
}

// ── DB save helpers ─────────────────────────────────────

async function saveExecutiveSummary(
  db: DbClient,
  markdown: string,
): Promise<boolean> {
  try {
    await db.knowledgeSnippet.upsert({
      where: { key: 'executive_summary' },
      create: {
        key: 'executive_summary',
        category: 'document',
        content: markdown,
      },
      update: {
        content: markdown,
        category: 'document',
      },
    });
    return true;
  } catch (err) {
    console.error('[ai-content] Failed to save executive summary:', err);
    return false;
  }
}

async function saveBusinessReviewParts(
  db: DbClient,
  parts: ReviewPart[],
  onProgress?: ProgressCallback,
): Promise<{ slug: string; title: string }[]> {
  const saved: { slug: string; title: string }[] = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    try {
      await db.businessReviewPart.upsert({
        where: { slug: part.slug },
        create: {
          slug: part.slug,
          partKey: part.partKey,
          title: part.title,
          sortOrder: part.sortOrder,
          authTier: 'google',
          markdown: part.markdown,
        },
        update: {
          title: part.title,
          sortOrder: part.sortOrder,
          markdown: part.markdown,
        },
      });
      saved.push({ slug: part.slug, title: part.title });
    } catch (err) {
      console.error(
        `[ai-content] Failed to save review part ${part.slug}:`,
        err,
      );
    }

    const pctBase = 75;
    const pctRange = 95 - pctBase;
    onProgress?.({
      step: 'saving',
      message: `Saving Business Review — part ${i + 1} of ${parts.length} (${part.title})...`,
      pct: Math.round(pctBase + (pctRange * (i + 1)) / parts.length),
      detail: { saved: saved.length, total: parts.length, current: part.title },
    });
  }

  return saved;
}

// ── Orchestrator ────────────────────────────────────────

/**
 * Run the full pipeline: extract → prompt → AI → parse → save.
 *
 * @param db         ZenStack/Prisma client for DB writes
 * @param onProgress Optional callback called at each stage with a ProgressEvent.
 *                    The caller can forward these to an SSE stream or progress bar.
 * @param source     Optional explicit file path (string) OR in-memory workbook Buffer.
 *                   When omitted auto-detects the file on disk or falls back to DB cache.
 * @param model      Optional OpenAI model name (default gpt-4o)
 */
export async function generateAndSave(
  db: DbClient,
  onProgress?: ProgressCallback,
  source?: string | Buffer,
  model?: string,
): Promise<GenerationResult & { saved?: SavedResult; prompt?: string }> {
  try {
    // ── 1. Extract Excel data ───────────────────────────
    onProgress?.({
      step: 'extracting',
      message: 'Reading Excel workbook and extracting financial data...',
      pct: 5,
    });

    const data = extractExcelData(source);

    onProgress?.({
      step: 'extracting',
      message: `Data extracted — ${data.profitAndLoss.length} P&L lines, ${data.bepMonthly.length} BEP months, ${data.summaryPl.length} years in multi-year summary`,
      pct: 15,
    });

    // ── 2. Build prompt ─────────────────────────────────
    onProgress?.({
      step: 'prompt',
      message: 'Building comprehensive AI prompt from financial data...',
      pct: 20,
    });

    const prompt = buildGenerationPrompt(data);
    const promptKb = (prompt.length / 1000).toFixed(0);

    onProgress?.({
      step: 'prompt',
      message: `AI prompt built — ${promptKb}K characters of structured financial data ready for OpenAI`,
      pct: 30,
    });

    // ── 3. Resolve API key ──────────────────────────────
    onProgress?.({
      step: 'openai',
      message: 'Resolving OpenAI API key...',
      pct: 35,
    });

    const apiKey = await resolveOpenAiKey();
    if (!apiKey) {
      const errorMsg =
        'OpenAI API key not configured. Set it in Config > OpenAI Key or via OPENAI_API_KEY env var.';
      onProgress?.({
        step: 'error',
        message: errorMsg,
        pct: 0,
        detail: { hint: 'Set your key in: Admin > Config > OpenAI Key, or add OPENAI_API_KEY to .env.local' },
      });
      return { success: false, error: errorMsg, prompt };
    }

    // ── 4. Call AI ──────────────────────────────────────
    const content = await callOpenAi(prompt, apiKey, model, onProgress);

    // ── 5. Validate response ────────────────────────────
    if (!content.businessReview && !content.executiveSummary) {
      const errorMsg =
        'AI returned empty content for both Business Review and Executive Summary.';
      onProgress?.({
        step: 'error',
        message: errorMsg,
        pct: 0,
        detail: { contentLengths: { businessReview: 0, executiveSummary: 0 } },
      });
      return { success: false, error: errorMsg, prompt, content };
    }

    onProgress?.({
      step: 'parsing',
      message: 'Parsing AI response into Business Review sections and Executive Summary...',
      pct: 65,
    });

    // ── 6. Parse into parts ─────────────────────────────
    const parts = parseReviewParts(content.businessReview);
    const bizReviewKb = (content.businessReview.length / 1000).toFixed(0);
    const execSumKb = (content.executiveSummary.length / 1000).toFixed(0);

    onProgress?.({
      step: 'parsing',
      message: `Parsed into ${parts.length} Business Review parts (${bizReviewKb}K chars) + Executive Summary (${execSumKb}K chars)`,
      pct: 75,
      detail: { partCount: parts.length, bizReviewKb, execSumKb },
    });

    // ── 7. Save to DB ───────────────────────────────────
    onProgress?.({
      step: 'saving',
      message: `Saving ${parts.length} Business Review ${parts.length === 1 ? 'part' : 'parts'} to database...`,
      pct: 78,
      detail: { total: parts.length, saved: 0 },
    });

    const savedParts = await saveBusinessReviewParts(db, parts, onProgress);

    onProgress?.({
      step: 'saving_exec',
      message: 'Saving Executive Summary to database...',
      pct: 95,
    });

    const execSummarySaved = await saveExecutiveSummary(
      db,
      content.executiveSummary,
    );

    // ── 8. Complete ─────────────────────────────────────
    const result: GenerationResult & { saved?: SavedResult; prompt?: string } = {
      success: true,
      prompt,
      content,
      saved: {
        businessReviewParts: savedParts,
        executiveSummarySaved: execSummarySaved,
      },
    };

    onProgress?.({
      step: 'complete',
      message: `✅ Generation complete — ${savedParts.length} review parts + executive summary saved to database`,
      pct: 100,
      detail: {
        businessReviewParts: savedParts,
        executiveSummarySaved: execSummarySaved,
        contentLengths: {
          businessReview: content.businessReview.length,
          executiveSummary: content.executiveSummary.length,
        },
        model: content.model,
      },
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    onProgress?.({
      step: 'error',
      message: `❌ Error: ${message}`,
      pct: 0,
      detail: { error: message },
    });
    return {
      success: false,
      error: message,
    };
  }
}
