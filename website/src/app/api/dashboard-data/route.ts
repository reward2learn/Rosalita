/**
 * Dashboard Data API
 *
 * GET /api/dashboard-data
 *   Returns structured dashboard data (action plan phases, target rows, levers)
 *   stored in knowledge_snippets under key "dashboard_data".
 *
 * POST /api/dashboard-data
 *   Saves dashboard data. Body: { actionPhases, targetRows, levers }
 *   Admin-only (requires write auth).
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const dashboardSchema = z.object({
  actionPhases: z.array(z.object({
    id: z.string(), title: z.string(), period: z.string(), impact: z.string(),
    actions: z.array(z.string()),
  })),
  targetRows: z.array(z.object({
    metric: z.string(), may: z.string(), conservative: z.string(),
    realistic: z.string(), aspirational: z.string(), bold: z.boolean().optional(),
  })),
  levers: z.array(z.object({
    num: z.number(), title: z.string(), summary: z.string(),
    details: z.array(z.string()),
  })),
});

export async function GET() {
  try {
    const db = createClient();
    const snippet = await db.knowledgeSnippet.findUnique({
      where: { key: 'dashboard_data' },
    });
    if (!snippet?.content) {
      return jsonOk(null);
    }
    const data = JSON.parse(snippet.content);
    return jsonOk(data);
  } catch {
    return jsonOk(null);
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const parsed = dashboardSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid dashboard data structure', 400);

  const db = createClient({
    tier: guard.session.tier as 'public' | 'pin' | 'google',
    sub: guard.session.sub,
  });

  try {
    await db.knowledgeSnippet.upsert({
      where: { key: 'dashboard_data' },
      create: {
        key: 'dashboard_data',
        category: 'document',
        content: JSON.stringify(parsed.data),
      },
      update: {
        content: JSON.stringify(parsed.data),
        category: 'document',
      },
    });
    return jsonOk({ saved: true });
  } catch (err) {
    return jsonError(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
