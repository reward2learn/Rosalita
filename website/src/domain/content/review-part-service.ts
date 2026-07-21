import type { DbClient } from '@/lib/db';
import { REVIEW_PART_FALLBACKS } from '@/domain/content/review-part-fallbacks';
import { resolveReviewPart } from '@/lib/page-catalog';

export interface ReviewPartContent {
  slug: string;
  title: string;
  markdown: string;
}

/**
 * Load a single review part from the database.  Falls back to the bundled
 * inline fallbacks (compiled at build time).  File-system markdown is no
 * longer read — the AI Content Generation pipeline saves directly to the
 * `business_review_parts` table.
 */
export async function getReviewPartContent(
  db: DbClient,
  rawSlug: string,
): Promise<ReviewPartContent | null> {
  const slug = rawSlug.trim().toLowerCase();
  if (!resolveReviewPart(slug)) {
    return null;
  }

  // DB is the source of truth (populated by AI Content Generation or seed).
  const row = await db.businessReviewPart.findUnique({ where: { slug } });
  if (row) {
    return {
      slug: row.slug,
      title: row.title,
      markdown: row.markdown,
    };
  }

  // Inline fallbacks compiled from the last manual markdown (static deployment).
  return REVIEW_PART_FALLBACKS[slug] ?? null;
}
