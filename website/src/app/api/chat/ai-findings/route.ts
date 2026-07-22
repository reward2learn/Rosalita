/**
 * AI Findings API
 *
 * POST /api/chat/ai-findings
 *   Saves AI chat response as a structured finding (JSON array stored in knowledge_snippets).
 *   Body: { content: string, title?: string }
 *   Each finding: { id, title, content, createdAt }
 *   Stored newest-first.
 *
 * GET /api/chat/ai-findings
 *   Returns { findings: AiFinding[] }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';

interface AiFinding {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

const postSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }

  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return jsonError('content (string) is required', 400);

  const { content, title } = parsed.data;
  const db = createClient({
    tier: guard.session.tier as 'public' | 'pin' | 'google',
    sub: guard.session.sub,
  });

  try {
    // Read existing findings
    const existing = await db.knowledgeSnippet.findUnique({
      where: { key: 'ai_findings' },
    });

    let findings: AiFinding[] = [];
    if (existing?.content) {
      try {
        findings = JSON.parse(existing.content);
        if (!Array.isArray(findings)) findings = [];
      } catch {
        findings = [];
      }
    }

    // Extract first line as title if not provided
    const firstLine = content.split('\n')[0]?.replace(/^#{1,3}\s+/, '').replace(/^\*\*|\*\*$/g, '').trim() ?? '';
    const finding: AiFinding = {
      id: `find-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: (title ?? firstLine.slice(0, 80)) || 'AI Finding',
      content,
      createdAt: new Date().toISOString(),
    };

    // Prepend newest first
    findings.unshift(finding);

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

    return jsonOk({ saved: true, id: finding.id });
  } catch (err) {
    return jsonError(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const db = createClient({
    tier: guard.session.tier as 'public' | 'pin' | 'google',
    sub: guard.session.sub,
  });

  try {
    const snippet = await db.knowledgeSnippet.findUnique({
      where: { key: 'ai_findings' },
    });

    let findings: AiFinding[] = [];
    if (snippet?.content) {
      try {
        findings = JSON.parse(snippet.content);
        if (!Array.isArray(findings)) findings = [];
      } catch {
        findings = [];
      }
    }

    return jsonOk({ findings });
  } catch (err) {
    return jsonError(`Read failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  }
}
