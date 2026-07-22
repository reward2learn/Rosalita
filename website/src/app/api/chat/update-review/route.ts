/**
 * Chat Review Update API
 *
 * POST /api/chat/update-review
 *   Accepts a chat conversation + summary and updates the Business Review
 *   and Executive Summary documents.
 *
 *   Body: { messages: { role: string; content: string }[], summary: string }
 *
 *   This endpoint exists to keep server-only imports (openai, db, etc.)
 *   out of the client bundle — the chat-panel calls this via fetch()
 *   rather than importing the module directly.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';

const reviewUpdateSchema = z.object({
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
  })).min(1),
  summary: z.string().min(1),
  target: z.enum(['review', 'executive_summary']).optional(),
});

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const parsed = reviewUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError('messages (min 1) and summary (string) are required', 400);
  }

  const { messages, summary, target } = parsed.data;
  const db = createClient({
    tier: guard.session.tier as 'public' | 'pin' | 'google',
    sub: guard.session.sub,
  });

  try {
    if (target === 'executive_summary') {
      // Only update the Executive Summary
      const { rephraseExecutiveSummary } = await import('@/domain/ai-content/chat-review-updater');
      const result = await rephraseExecutiveSummary(db, messages, summary);
      if (result.success) {
        return jsonOk({ partsUpdated: 1 });
      }
      return jsonError(result.error ?? 'Update failed', 500);
    }

    // Default: update Business Review parts
    const { rephraseReviewDocumentsFromChat } = await import('@/domain/ai-content/chat-review-updater');
    const result = await rephraseReviewDocumentsFromChat(db, messages, summary);

    if (result.success) {
      return jsonOk({ partsUpdated: result.partsUpdated });
    }
    return jsonError(result.error ?? 'Update failed', 500);
  } catch (err) {
    return jsonError(`Update failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
