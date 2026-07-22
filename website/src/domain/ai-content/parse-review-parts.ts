/**
 * Parse the Business Review markdown into part-based sections.
 * Extracted into its own file to avoid pulling node:fs into client bundles.
 */

export interface ReviewPart {
  slug: string;
  partKey: string;
  title: string;
  sortOrder: number;
  markdown: string;
}

/**
 * Parse the Business Review markdown into part-based sections.
 * Splits on ## Part X: or ### Part X: headers.
 */
export function parseReviewParts(markdown: string): ReviewPart[] {
  const parts: ReviewPart[] = [];
  // Match headers like: ## Part A: ... or ### Part A: ...
  const partRegex = /^#{1,3}\s+(Part\s+([A-Z]):\s*(.+))/gm;
  const matches: {
    index: number;
    fullMatch: string;
    partKey: string;
    title: string;
  }[] = [];

  let match;
  while ((match = partRegex.exec(markdown)) !== null) {
    matches.push({
      index: match.index,
      fullMatch: match[0],
      partKey: match[2],
      title: match[1].trim(),
    });
  }

  // If no parts found, create one default part
  if (matches.length === 0) {
    parts.push({
      slug: 'part-a',
      partKey: 'A',
      title: 'Part A: Business Review',
      sortOrder: 0,
      markdown: markdown,
    });
    return parts;
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const startIdx = current.index;
    const endIdx = next ? next.index : markdown.length;
    const sectionContent = markdown.slice(startIdx, endIdx).trim();

    const slug = `part-${current.partKey.toLowerCase()}`;
    parts.push({
      slug,
      partKey: current.partKey,
      title: current.title,
      sortOrder: i,
      markdown: sectionContent,
    });
  }

  return parts;
}
