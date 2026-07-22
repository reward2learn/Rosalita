/**
 * Summarize Finding API
 *
 * POST /api/chat/summarize-finding
 *   Body: { content: string }
 *   Calls OpenAI to produce a 2-3 sentence summary of the finding content.
 *   Returns: { summary: string }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWriteAuth } from '@/lib/auth/guards';
import { resolveOpenAiKey } from '@/lib/openai';
import { jsonError, jsonOk } from '@/lib/api/response';

const schema = z.object({
  content: z.string().min(1).max(50000),
});

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return jsonError('content (string) is required', 400);

  const { content } = parsed.data;
  const apiKey = await resolveOpenAiKey();
  if (!apiKey) return jsonError('OpenAI API key not configured', 503);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You summarize business analysis findings in 2-3 concise sentences. Return ONLY the summary text, no preamble.',
          },
          {
            role: 'user',
            content: `Summarize this finding:\n\n${content}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      return jsonError('OpenAI API error', 502);
    }

    const result = await response.json();
    const summary = result.choices?.[0]?.message?.content ?? '';

    return jsonOk({ summary: summary.trim() });
  } catch (err) {
    return jsonError(`Summarize failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
