import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DbClient } from '@/lib/db';
import { REVIEW_PART_FALLBACKS } from '@/domain/content/review-part-fallbacks';
import { parseBusinessReviewParts } from '@/lib/parse-business-review';
import { REVIEW_PART_CATALOG, resolveReviewPart } from '@/lib/page-catalog';

export interface ReviewPartContent {
  slug: string;
  title: string;
  markdown: string;
}

const BUSINESS_REVIEW_PATHS = [
  resolve(process.cwd(), '../Rosalita Business Review — June 2026.md'),
  resolve(process.cwd(), 'Rosalita Business Review — June 2026.md'),
];

let cachedParts: Map<string, ReviewPartContent> | null = null;

function loadPartsFromMarkdown(): Map<string, ReviewPartContent> {
  if (cachedParts) return cachedParts;

  const path = BUSINESS_REVIEW_PATHS.find((candidate) => existsSync(candidate));
  if (!path) {
    cachedParts = new Map();
    return cachedParts;
  }

  const parsed = parseBusinessReviewParts(readFileSync(path, 'utf8'));
  cachedParts = new Map(
    parsed.map((part) => {
      const catalog = REVIEW_PART_CATALOG[part.slug];
      return [
        part.slug,
        {
          slug: part.slug,
          title: catalog?.title ?? part.title,
          markdown: part.markdown,
        },
      ];
    }),
  );
  return cachedParts;
}

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase();
}

export async function getReviewPartContent(
  db: DbClient,
  rawSlug: string,
): Promise<ReviewPartContent | null> {
  const slug = normalizeSlug(rawSlug);
  if (!resolveReviewPart(slug)) {
    return null;
  }

  const row = await db.businessReviewPart.findUnique({ where: { slug } });
  if (row) {
    return {
      slug: row.slug,
      title: row.title,
      markdown: row.markdown,
    };
  }

  const fromFile = loadPartsFromMarkdown().get(slug);
  if (fromFile) return fromFile;

  return REVIEW_PART_FALLBACKS[slug] ?? null;
}
