/**
 * Batch Save AI Findings API
 *
 * POST /api/chat/ai-findings/save-batch
 *   Replaces all findings with a new array.
 *   Body: { findings: AiFinding[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';

const batchSchema = z.object({
  findings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    content: z.string(),
    createdAt: z.string(),
  })),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) return jsonError('findings array is required', 400);

  const { findings } = parsed.data;
  const db = createClient({
    tier: guard.session.tier as 'public' | 'pin' | 'google',
    sub: guard.session.sub,
  });

  try {
    await db.knowledgeSnippet.upsert({
      where: { key: 'ai_findings' },
      create: {
        key: 'ai_findings',
        category: 'document',
        content: JSON.stringify(findings),
      },
      update: {
        content: JSON.stringify(findings),
        category: 'document',
      },
    });

    return jsonOk({ saved: findings.length });
  } catch (err) {
    return jsonError(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
