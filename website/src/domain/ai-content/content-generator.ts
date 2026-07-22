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

import { extractExcelData, extractExcelDataFromBuffers } from '@/domain/excel/excel-extractor';
import { buildGenerationPrompt, buildDashboardPrompt } from '@/domain/ai-content/prompt-builder';
import { resolveOpenAiKey } from '@/lib/openai';
import type { DbClient } from '@/lib/db';
import { parseReviewParts } from '@/domain/ai-content/parse-review-parts';
import type { ReviewPart } from '@/domain/ai-content/parse-review-parts';

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

/**
 * Call OpenAI to generate a single document (business review OR executive summary).
 * Keeps each response within the model's 16384 output-token limit.
 */
async function callOpenAiForDocument(
  prompt: string,
  apiKey: string,
  documentType: 'businessReview' | 'executiveSummary' | 'dashboardData',
  model = 'gpt-4o',
  onProgress?: ProgressCallback,
): Promise<string> {
  const docLabel = documentType === 'businessReview' ? 'Business Review' : documentType === 'executiveSummary' ? 'Executive Summary' : 'Dashboard Data';

  onProgress?.({
    step: 'openai',
    message: `Calling OpenAI — generating ${docLabel} (${model})...`,
    pct: documentType === 'businessReview' ? 40 : 55,
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
            'You are a precise financial analyst and business writer. You ALWAYS return only valid JSON with exactly the key requested.',
        },
        {
          role: 'user',
          content: `${prompt}\n\nGenerate ONLY the "${documentType}" document as a JSON object with a single key "${documentType}" containing the full Markdown string. Do NOT include the other document.`,
        },
      ],
      temperature: 0.3,
      max_tokens: 16384,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API error (${response.status}): ${errBody}`);
  }

  const result = await response.json();
  const reply = result.choices?.[0]?.message?.content ?? '';

  let parsed: Record<string, string>;
  try {
    parsed = JSON.parse(reply);
  } catch {
    const jsonMatch = reply.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[1]);
    } else {
      throw new Error(
        'AI response was not valid JSON. Raw response: ' + reply.slice(0, 500),
      );
    }
  }

  return parsed[documentType] ?? '';
}

// ── Content parsing helpers ─────────────────────────────
// (parseReviewParts imported from parse-review-parts.ts)
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
  source?: string | Buffer | Buffer[],
  model?: string,
  additionalContext?: string,
): Promise<GenerationResult & { saved?: SavedResult; prompt?: string }> {
  try {
    // ── 1. Extract Excel data ───────────────────────────
    onProgress?.({
      step: 'extracting',
      message: 'Reading Excel workbook and extracting financial data...',
      pct: 5,
    });

    const data = Array.isArray(source)
      ? extractExcelDataFromBuffers(source)
      : extractExcelData(source);

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

    const prompt = buildGenerationPrompt(data, additionalContext);
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

    // ── 4. Call AI in two phases ─────────────────────────
    // Phase 1: Generate Business Review
    onProgress?.({
      step: 'openai',
      message: 'Generating Business Review from financial data (phase 1 of 2)...',
      pct: 40,
    });

    const businessReview = await callOpenAiForDocument(
      prompt, apiKey, 'businessReview', model, onProgress,
    );

    // Phase 2: Generate Executive Summary
    onProgress?.({
      step: 'openai',
      message: 'Generating Executive Summary from financial data (phase 2 of 2)...',
      pct: 55,
    });

    const executiveSummary = await callOpenAiForDocument(
      prompt, apiKey, 'executiveSummary', model, onProgress,
    );

    const content: AiGeneratedContent = {
      businessReview,
      executiveSummary,
      promptLength: prompt.length,
      responseLength: businessReview.length + executiveSummary.length,
      model: model ?? 'gpt-4o',
    };

    // Phase 3: Generate Dashboard Data (action plan, targets, levers)
    onProgress?.({
      step: 'openai',
      message: 'Generating Dashboard data from financial analysis (phase 3 of 3)...',
      pct: 65,
    });

    let dashboardData: Record<string, unknown> | null = null;
    try {
      const dashboardPrompt = buildDashboardPrompt(data, additionalContext);
      const dashResult = await callOpenAiForDocument(
        dashboardPrompt, apiKey, 'dashboardData', model, onProgress,
      );
      if (dashResult) {
        try {
          const parsed = JSON.parse(dashResult);
          if (parsed.actionPhases && parsed.targetRows && parsed.levers) {
            dashboardData = parsed;
            // Save to knowledge_snippets so the dashboard blocks can read it
            await db.knowledgeSnippet.upsert({
              where: { key: 'dashboard_data' },
              create: {
                key: 'dashboard_data',
                category: 'document',
                content: JSON.stringify(parsed),
              },
              update: {
                content: JSON.stringify(parsed),
                category: 'document',
              },
            });
          }
        } catch {
          // non-critical — dashboard just shows hardcoded fallbacks
        }
      }
    } catch {
      // non-critical
    }

    onProgress?.({
      step: 'parsing',
      message: 'AI responses received — parsing into Business Review sections and Executive Summary...',
      pct: 70,
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

    // Register saved parts in the in-memory catalog so /review/part-* routes resolve immediately
    if (savedParts.length > 0) {
      const { setDynamicReviewParts } = await import('@/lib/page-catalog');
      setDynamicReviewParts(
        parts.map((p) => ({
          partSlug: p.slug,
          partKey: p.partKey,
          title: p.title,
          authTier: 'google' as const,
        })),
      );
    }

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
