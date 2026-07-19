/**
 * Parse Business Review MD into Parts.
 * Accepts any label after "Part" followed by either:
 *   - a colon separator: "## Part I: Title"
 *   - an em-dash or en-dash separator: "## Part I — Title" or "## Part I - Title"
 */

export interface BusinessReviewPartParsed {
  partKey: string;
  slug: string;
  title: string;
  sortOrder: number;
  markdown: string;
}

/** Matches "## Part <label>: <title>" */
const PART_HEADER_COLON = /^## Part ([^:]+): (.+)$/m;

/** Matches "## Part <label> — <title>" or "## Part <label> - <title>" (em-dash/en-dash) */
const PART_HEADER_DASH = /^## Part (.+?)[—-]\s*(.+)$/m;

export function parseBusinessReviewParts(markdown: string): BusinessReviewPartParsed[] {
  const lines = markdown.split('\n');
  const headerIndices: { index: number; partKey: string; title: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    let match = null as RegExpMatchArray | null;

    // Try colon separator first
    if (!match) {
      match = lines[i].match(PART_HEADER_COLON);
    }
    // Fall back to dash/em-dash separator
    if (!match) {
      match = lines[i].match(PART_HEADER_DASH);
    }

    if (match) {
      headerIndices.push({
        index: i,
        // Use label before the separator as partKey (e.g., "I", "II", "VI")
        partKey: match[1].trim(),
        title: `Part ${match[1].trim()}: ${match[2].trim()}`,
      });
    }
  }

  if (headerIndices.length === 0) {
    throw new Error(
      'No "## Part <label>: <title>" or "## Part <label> — <title>" sections found in Business Review MD'
    );
  }

  const parts: BusinessReviewPartParsed[] = [];

  for (let i = 0; i < headerIndices.length; i++) {
    const current = headerIndices[i];
    const nextIndex = i + 1 < headerIndices.length ? headerIndices[i + 1].index : lines.length;
    const bodyLines = lines.slice(current.index, nextIndex);

    parts.push({
      partKey: current.partKey,
      slug: `part-${current.partKey.toLowerCase()}`,
      title: current.title,
      // Sort by document order — index 0, 1, 2... regardless of label type (Roman, Arabic, etc.)
      sortOrder: i,
      markdown: bodyLines.join('\n').trim(),
    });
  }

  return parts;
}

/** Validate a single part header line — accepts both colon and dash separators. */
export function isPartHeader(line: string): boolean {
  return PART_HEADER_COLON.test(line) || PART_HEADER_DASH.test(line);
}
