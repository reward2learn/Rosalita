/**
 * Parse Business Review MD into Parts A–O.
 */

export interface BusinessReviewPartParsed {
  partKey: string;
  slug: string;
  title: string;
  sortOrder: number;
  markdown: string;
}

const PART_HEADER = /^## Part ([A-O]): (.+)$/m;

export function parseBusinessReviewParts(markdown: string): BusinessReviewPartParsed[] {
  const lines = markdown.split('\n');
  const headerIndices: { index: number; partKey: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^## Part ([A-O]): (.+)$/);
    if (match) {
      headerIndices.push({
        index: i,
        partKey: match[1],
        title: `Part ${match[1]}: ${match[2]}`,
      });
    }
  }

  if (headerIndices.length === 0) {
    throw new Error('No "## Part A:" … "## Part O:" sections found in Business Review MD');
  }

  const parts: BusinessReviewPartParsed[] = [];

  for (let i = 0; i < headerIndices.length; i++) {
    const current = headerIndices[i];
    const nextIndex = i + 1 < headerIndices.length ? headerIndices[i + 1].index : lines.length;
    const bodyLines = lines.slice(current.index, nextIndex);
    const partKey = current.partKey;
    const slug = `part-${partKey.toLowerCase()}`;

    parts.push({
      partKey,
      slug,
      title: current.title,
      sortOrder: partKey.charCodeAt(0) - 'A'.charCodeAt(0),
      markdown: bodyLines.join('\n').trim(),
    });
  }

  return parts;
}

/** Validate a single part header line (exported for dry-run tests). */
export function isPartHeader(line: string): boolean {
  return PART_HEADER.test(line);
}
