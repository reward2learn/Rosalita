/**
 * Content API — serves markdown content for doc_markdown blocks.
 *
 * GET /api/content?source=<source>
 *
 * Source resolution order:
 *   1. review:part-a      → BusinessReviewPart table
 *   2. review/part-a      → BusinessReviewPart table
 *   3. Known aliases:
 *        executive-summary  → knowledge_snippets (key: executive_summary)
 *        terms-of-service.html → legal/ HTML file
 *        privacy-policy.html   → legal/ HTML file
 *        part-o               → BusinessReviewPart
 *   4. part-[a-o]          → BusinessReviewPart
 *   5. Everything else     → knowledge_snippets (key: source with [.-] → _)
 *        e.g. sheet-month-on-month → key: sheet_month_on_month
 *        e.g. workbook-summary     → key: workbook_summary
 *
 * Uses a direct PrismaClient for DB reads to avoid ZenStack policy
 * filtering on models that may not have explicit @@allow('read', true).
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// ── Source resolution ───────────────────────────────────

const SOURCE_ALIASES: Record<string, { type: 'snippet'; key: string } | { type: 'part'; slug: string } | { type: 'file'; filename: string }> = {
  'executive-summary': { type: 'snippet', key: 'executive_summary' },
  'terms-of-service.html': { type: 'file', filename: 'terms-of-service.html' },
  'privacy-policy.html': { type: 'file', filename: 'privacy-policy.html' },
  'part-o': { type: 'part', slug: 'part-o' },
};

function resolveSource(source: string): { type: 'snippet'; key: string } | { type: 'part'; slug: string } | { type: 'file'; filename: string } {
  const normalized = source.trim();
  if (normalized.startsWith('review:')) {
    return { type: 'part', slug: normalized.slice('review:'.length).trim().toLowerCase() };
  }
  if (normalized.startsWith('review/')) {
    return { type: 'part', slug: normalized.slice('review/'.length).trim().toLowerCase() };
  }
  const alias = SOURCE_ALIASES[normalized];
  if (alias) return alias;
  const lower = normalized.toLowerCase();
  if (/^part-[a-o]$/.test(lower)) {
    return { type: 'part', slug: lower };
  }
  return { type: 'snippet', key: normalized.replace(/[.-]/g, '_') };
}

// ── HTML helpers ────────────────────────────────────────

function readBundledHtml(filename: string): string | null {
  const safeName = filename.replace(/\.\./g, '').replace(/[/\\]/g, '');
  const path = resolve(process.cwd(), 'legal', safeName);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

function htmlToMarkdownish(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Prisma helper ───────────────────────────────────────

function getClient() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');
  return new PrismaClient({ datasources: { db: { url } } });
}

// ── GET handler ─────────────────────────────────────────

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return NextResponse.json({ error: 'Missing source query parameter' }, { status: 400 });
  }

  const prisma = getClient();

  try {
    const resolved = resolveSource(source);

    if (resolved.type === 'part') {
      const row = await prisma.businessReviewPart.findUnique({
        where: { slug: resolved.slug },
      });
      if (!row) {
        return NextResponse.json({ error: 'Content not found', source }, { status: 404 });
      }
      return NextResponse.json({
        source,
        title: row.title,
        markdown: row.markdown,
        contentType: 'markdown',
      });
    }

    if (resolved.type === 'file') {
      const html = readBundledHtml(resolved.filename);
      if (!html) {
        return NextResponse.json({ error: 'Content not found', source }, { status: 404 });
      }
      return NextResponse.json({
        source,
        title: resolved.filename.replace(/\.html$/, '').replace(/-/g, ' '),
        markdown: htmlToMarkdownish(html),
        contentType: 'markdown',
      });
    }

    // Snippet lookup — uses direct PrismaClient (no ZenStack policy filtering)
    const row = await prisma.knowledgeSnippet.findUnique({
      where: { key: resolved.key },
    });
    if (!row) {
      return NextResponse.json({ error: 'Content not found', source }, { status: 404 });
    }
    return NextResponse.json({
      source,
      title: row.key,
      markdown: row.content,
      contentType: row.category === 'document' ? 'markdown' : 'text',
    });
  } catch (err) {
    console.error('[content]', source, err);
    return NextResponse.json({ error: 'Content unavailable', source }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
