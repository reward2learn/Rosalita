import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { getReviewPartContent } from '@/domain/content/review-part-service';
import { KnowledgeService } from '@/domain/knowledge/knowledge-service';

/** Map doc_markdown `source` config keys to DB lookups. */
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

/** Read bundled legal HTML from legal/ subdirectory */
function readBundledHtml(filename: string): string | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { readFileSync, existsSync } = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resolve } = require('node:path');
  // Scoped to legal/ subdirectory — prevents Turbopack from tracing the whole project
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

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source');

  if (!source) {
    return NextResponse.json({ error: 'Missing source query parameter' }, { status: 400 });
  }

  try {
    const db = createClient();
    const resolved = resolveSource(source);

    if (resolved.type === 'part') {
      const part = await getReviewPartContent(db, resolved.slug);
      if (!part) {
        return NextResponse.json({ error: 'Content not found', source }, { status: 404 });
      }
      return NextResponse.json({
        source,
        title: part.title,
        markdown: part.markdown,
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

    const knowledge = new KnowledgeService(db);
    const snippet = await knowledge.getSnippetByKey(resolved.key);
    if (!snippet) {
      return NextResponse.json({ error: 'Content not found', source }, { status: 404 });
    }

    return NextResponse.json({
      source,
      title: snippet.key,
      markdown: snippet.content,
      contentType: snippet.category === 'document' ? 'markdown' : 'text',
    });
  } catch (err) {
    console.error('[content]', source, err);
    return NextResponse.json({ error: 'Content unavailable', source }, { status: 500 });
  }
}
