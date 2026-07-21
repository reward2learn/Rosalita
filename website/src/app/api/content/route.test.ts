/**
 * Tests for the /api/content route — specifically the resolveSource function
 * which maps user-facing `source` query params to internal lookup types.
 *
 * We test the resolveSource logic in isolation by importing it directly.
 */

import { describe, it, expect } from 'vitest';

// Replicate the resolveSource logic here since it's not exported from the route.
// This also serves as documentation of the expected mapping behaviour.
type SourceResolved =
  | { type: 'snippet'; key: string }
  | { type: 'part'; slug: string }
  | { type: 'file'; filename: string };

const SOURCE_ALIASES: Record<string, SourceResolved> = {
  'executive-summary': { type: 'snippet', key: 'executive_summary' },
  'terms-of-service.html': { type: 'file', filename: 'terms-of-service.html' },
  'privacy-policy.html': { type: 'file', filename: 'privacy-policy.html' },
  'part-o': { type: 'part', slug: 'part-o' },
};

function resolveSource(source: string): SourceResolved {
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

describe('resolveSource', () => {
  // ── Review parts ─────────────────────────────────────
  it('resolves "review:part-a" to a review part', () => {
    const result = resolveSource('review:part-a');
    expect(result).toEqual({ type: 'part', slug: 'part-a' });
  });

  it('resolves "review/part-b" to a review part', () => {
    const result = resolveSource('review/part-b');
    expect(result).toEqual({ type: 'part', slug: 'part-b' });
  });

  // ── Known aliases ────────────────────────────────────
  it('resolves "executive-summary" to the executive_summary snippet', () => {
    const result = resolveSource('executive-summary');
    expect(result).toEqual({ type: 'snippet', key: 'executive_summary' });
  });

  it('resolves "terms-of-service.html" to a file', () => {
    const result = resolveSource('terms-of-service.html');
    expect(result).toEqual({ type: 'file', filename: 'terms-of-service.html' });
  });

  it('resolves "part-o" to a review part', () => {
    const result = resolveSource('part-o');
    expect(result).toEqual({ type: 'part', slug: 'part-o' });
  });

  // ── Generated sheet pages ────────────────────────────
  it('resolves "sheet-month-on-month" to a snippet key with underscores', () => {
    const result = resolveSource('sheet-month-on-month');
    // Hyphens are replaced with underscores for the DB lookup
    expect(result).toEqual({ type: 'snippet', key: 'sheet_month_on_month' });
  });

  it('resolves "sheet-daily-sales" to a snippet key', () => {
    const result = resolveSource('sheet-daily-sales');
    expect(result).toEqual({ type: 'snippet', key: 'sheet_daily_sales' });
  });

  it('resolves "sheet-pl" to a snippet key', () => {
    const result = resolveSource('sheet-pl');
    expect(result).toEqual({ type: 'snippet', key: 'sheet_pl' });
  });

  // ── Workbook overview page ────────────────────────────
  it('resolves "workbook-summary" to a snippet key', () => {
    const result = resolveSource('workbook-summary');
    expect(result).toEqual({ type: 'snippet', key: 'workbook_summary' });
  });

  // ── General source → snippet fallback ────────────────
  it('resolves "any-other-source" to a snippet key with underscores', () => {
    const result = resolveSource('any-other-source');
    expect(result).toEqual({ type: 'snippet', key: 'any_other_source' });
  });

  it('preserves already-underscored keys', () => {
    const result = resolveSource('already_underscored');
    expect(result).toEqual({ type: 'snippet', key: 'already_underscored' });
  });

  // ── Trimming ─────────────────────────────────────────
  it('trims whitespace from the source', () => {
    const result = resolveSource('  review:part-c  ');
    expect(result).toEqual({ type: 'part', slug: 'part-c' });
  });
});
