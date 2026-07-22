import type { DbClient } from '@/lib/db';
import { resolveReviewPart } from '@/lib/page-catalog';

export interface ReviewPartContent {
  slug: string;
  title: string;
  markdown: string;
}

/**
 * Load a single review part from the database.
 * The AI Content Generation pipeline saves directly to the
 * `business_review_parts` table — if no row exists, returns null.
 */
export async function getReviewPartContent(
  db: DbClient,
  rawSlug: string,
): Promise<ReviewPartContent | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!resolveReviewPart(slug)) {
    return null;
  }

  // DB is the only source of truth (populated by AI Content Generation or seed).
  const row = await db.businessReviewPart.findUnique({ where: { slug } });
  if (!row) return null;

  return {
    slug: row.slug,
    title: row.title,
    markdown: row.markdown,
  };
}
