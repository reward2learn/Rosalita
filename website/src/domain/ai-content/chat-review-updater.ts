/**
 * Chat-to-Review Updater
 *
 * Takes a chat conversation (user + assistant messages) and a summary of
 * key updates, then calls OpenAI to rephrase/update the Business Review
 * and Executive Summary documents with the new information.
 *
 * This allows management to have a conversation with the chatbot about
 * new data, corrections, or strategic shifts, then save those insights
 * directly into the review documents.
 */
import type { DbClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';
import type { ReviewPart } from './parse-review-parts';

interface UpdateResult {
  success: boolean;
  partsUpdated: number;
  error?: string;
}

/**
 * Update the Business Review and Executive Summary using chat insights.
 *
 * Steps:
 *   1. Read current review parts + executive summary from the DB
 *   2. Build a prompt with current content + chat history + update summary
 *   3. Call OpenAI to generate updated documents
 *   4. Save updated documents to DB
 *   5. Register updated parts in the catalog
 */
export async function rephraseReviewDocumentsFromChat(
  db: DbClient,
  messages: { role: string; content: string }[],
  summary: string,
): Promise<UpdateResult> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    return { success: false, partsUpdated: 0, error: 'OpenAI API key not configured.' };
  }

  // 1) Read current review parts from DB
  const currentParts = await db.businessReviewPart.findMany({
    orderBy: { sortOrder: 'asc' },
  });

  // 2) Read current executive summary
  const execSnippet = await db.knowledgeSnippet.findUnique({
    where: { key: 'executive_summary' },
  });

  const currentExecSummary = execSnippet?.content ?? '';

  // 3) Build chat transcript
  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  // 4) Build prompt for document update
  const currentReviewText = currentParts
    .map((p: ReviewPart) => `### ${p.title}\n\n${p.markdown}`)
    .join('\n\n');

  const promptSections = [
    `You are a financial analyst updating the Red Ruby Club & Terrace Bar Business Review and Executive Summary.`,
    ``,
    `## CURRENT Business Review`,
    currentReviewText || '(No existing review — create from scratch)',
    ``,
    `## CURRENT Executive Summary`,
    currentExecSummary || '(No existing executive summary — create from scratch)',
    ``,
    `## Conversation Transcript (user requesting updates)`,
    transcript,
    ``,
    `## Update Summary`,
    summary,
    ``,
    `## Instructions`,
    `Rewrite the Business Review and Executive Summary incorporating the new information from the conversation transcript and update summary above.`,
    `Preserve all existing data that is still accurate. Add new data and insights from the conversation.`,
    `Return ONLY a JSON object with two keys: "businessReview" and "executiveSummary".`,
    `Both values must be valid Markdown strings.`,
    ``,
    `### Business Review Requirements`,
    `Generate a comprehensive multi-part business review in Markdown with the following structure:`,
    `- **Part A: Current Situation — The Numbers**`,
    `- **Part B: The 10-Year Growth Model**`,
    `- **Part C: Revenue Optimization Strategy**`,
    `- **Part D: Cost Management**`,
    `- **Part E: Risk Register**`,
    `- **Part F: StarWORLD Membership Program**`,
    `- **Part G: Immediate Actions (Next 30 Days)**`,
    ``,
    `### Executive Summary Requirements`,
    `Generate the Executive Summary as a formal exit-viability assessment document with:`,
    `- **The Appointment — Restated Mandate**`,
    `- **Part I — What's Wrong (The Diagnostic)**`,
    `- **Part II — What It Costs to Wait**`,
    `- **Part III — Valuation Implications for the Share Sale**`,
    `- **Part IV — Critical Actions by Stakeholder**`,
    `- **Part V — The Pathway Summary**`,
    ``,
    `Base ALL numbers and analysis on the provided data. Use IDR formatting (e.g., "IDR 1.98B").`,
  ].join('\n');

  // 5) Call OpenAI (two-phase: Business Review first, then Executive Summary)
  const model = 'gpt-4o';

  // Phase 1: Business Review
  const bizReview = await callForDocument(promptSections, 'businessReview', apiKey, model);
  if (bizReview === null) {
    return { success: false, partsUpdated: 0, error: 'Failed to generate Business Review.' };
  }

  // Phase 2: Executive Summary
  const execSummary = await callForDocument(promptSections, 'executiveSummary', apiKey, model);
  if (execSummary === null) {
    return { success: false, partsUpdated: 0, error: 'Failed to generate Executive Summary.' };
  }

  // 6) Save updated documents to DB
  const { parseReviewParts } = await import('@/domain/ai-content/parse-review-parts');

  const parts = parseReviewParts(bizReview);
  let partsSaved = 0;

  for (const part of parts) {
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
      partsSaved++;
    } catch (err) {
      console.error(`[chat-review-updater] Failed to save part ${part.slug}:`, err);
    }
  }

  // Save executive summary
  try {
    await db.knowledgeSnippet.upsert({
      where: { key: 'executive_summary' },
      create: {
        key: 'executive_summary',
        category: 'document',
        content: execSummary,
      },
      update: {
        content: execSummary,
        category: 'document',
      },
    });
  } catch (err) {
    console.error('[chat-review-updater] Failed to save executive summary:', err);
  }

  // 7) Register in catalog
  if (partsSaved > 0) {
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

  return { success: true, partsUpdated: partsSaved };
}

/**
 * Update ONLY the Executive Summary using chat insights.
 * Does not touch Business Review parts.
 */
export async function rephraseExecutiveSummary(
  db: DbClient,
  messages: { role: string; content: string }[],
  summary: string,
): Promise<UpdateResult> {
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    return { success: false, partsUpdated: 0, error: 'OpenAI API key not configured.' };
  }

  // Read current executive summary
  const execSnippet = await db.knowledgeSnippet.findUnique({
    where: { key: 'executive_summary' },
  });
  const currentExecSummary = execSnippet?.content ?? '';

  // Build chat transcript
  const transcript = messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
    .join('\n\n');

  // Build prompt
  const promptSections = [
    `You are a financial analyst updating the Red Ruby Club & Terrace Bar Executive Summary.`,
    ``,
    `## CURRENT Executive Summary`,
    currentExecSummary || '(No existing executive summary — create from scratch)',
    ``,
    `## Conversation Transcript (user requesting updates)`,
    transcript,
    ``,
    `## Update Summary`,
    summary,
    ``,
    `## Instructions`,
    `Rewrite the Executive Summary only, incorporating the new information from the conversation above.`,
    `Preserve all existing data that is still accurate.`,
    `Return ONLY a JSON object with a single key "executiveSummary" containing the full Markdown string.`,
    ``,
    `### Executive Summary Requirements`,
    `Generate the Executive Summary as a formal exit-viability assessment document with:`,
    `- **The Appointment — Restated Mandate**`,
    `- **Part I — What's Wrong (The Diagnostic)**`,
    `- **Part II — What It Costs to Wait**`,
    `- **Part III — Valuation Implications for the Share Sale**`,
    `- **Part IV — Critical Actions by Stakeholder**`,
    `- **Part V — The Pathway Summary**`,
    ``,
    `Base ALL numbers and analysis on the provided data. Use IDR formatting (e.g., "IDR 1.98B").`,
  ].join('\n');

  // Call OpenAI
  const model = 'gpt-4o';
  const execSummary = await callForDocument(promptSections, 'executiveSummary', apiKey, model);
  if (execSummary === null) {
    return { success: false, partsUpdated: 0, error: 'Failed to generate Executive Summary.' };
  }

  // Save
  try {
    await db.knowledgeSnippet.upsert({
      where: { key: 'executive_summary' },
      create: {
        key: 'executive_summary',
        category: 'document',
        content: execSummary,
      },
      update: {
        content: execSummary,
        category: 'document',
      },
    });
    return { success: true, partsUpdated: 1 };
  } catch (err) {
    console.error('[chat-review-updater] Failed to save executive summary:', err);
    return { success: false, partsUpdated: 0, error: 'Failed to save to database.' };
  }
}

/**
 * Call OpenAI to generate a single document.
 */
async function callForDocument(
  prompt: string,
  documentType: 'businessReview' | 'executiveSummary',
  apiKey: string,
  model: string,
): Promise<string | null> {
  try {
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
            content: 'You are a precise financial analyst and business writer. You ALWAYS return only valid JSON with exactly the key requested.',
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

    if (!response.ok) return null;

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
        return null;
      }
    }

    return parsed[documentType] ?? null;
  } catch {
    return null;
  }
}
