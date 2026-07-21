/**
 * Generate bundled review part fallbacks from the Business Review markdown.
 * Run: bun run scripts/generate-review-part-fallbacks.ts
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBusinessReviewParts } from '../src/lib/parse-business-review.js';
import { REVIEW_PART_CATALOG } from '../src/lib/page-catalog.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

const BUSINESS_REVIEW_PATHS = [
  resolve(ROOT, '../business-review.md'),
  resolve(ROOT, 'business-review.md'),
  resolve(ROOT, '../Red Ruby Business Review — June 2026.md'),
  resolve(ROOT, 'Red Ruby Business Review — June 2026.md'),
];

const sourcePath = BUSINESS_REVIEW_PATHS.find((p) => existsSync(p));
if (!sourcePath) {
  console.error('[generate-review-part-fallbacks] Business Review markdown not found — checked generic paths and legacy name');
  process.exit(1);
}

const parsed = parseBusinessReviewParts(readFileSync(sourcePath, 'utf8'));
const outPath = resolve(ROOT, 'src/domain/content/review-part-fallbacks.ts');

const entries = parsed.map((part) => {
  const catalog = REVIEW_PART_CATALOG[part.slug];
  const title = catalog?.title ?? part.title;
  return `  '${part.slug}': {
    slug: '${part.slug}',
    title: ${JSON.stringify(title)},
    markdown: ${JSON.stringify(part.markdown)},
  }`;
});

const output = `/** Auto-generated from the Business Review markdown source — do not edit manually. */
/** Regenerate: bun run scripts/generate-review-part-fallbacks.ts */

export interface ReviewPartFallback {
  slug: string;
  title: string;
  markdown: string;
}

export const REVIEW_PART_FALLBACKS: Record<string, ReviewPartFallback> = {
${entries.join(',\n')},
};
`;

writeFileSync(outPath, output, 'utf8');
console.log(`[generate-review-part-fallbacks] Wrote ${parsed.length} parts to ${outPath}`);
