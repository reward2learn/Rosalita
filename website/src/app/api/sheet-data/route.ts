/**
 * Sheet Data API
 *
 * GET /api/sheet-data?sheet=PL&page=1&perPage=200
 *
 * Reads the cached workbook, detects the header row automatically, and returns
 * paginated sheet data as a JSON array of objects keyed by column header.
 *
 * Query params:
 *   sheet   — exact or case-insensitive tab name (required)
 *   page    — page number, 1-based (default 1)
 *   perPage — rows per page (default 200, max 1000)
 *
 * Returns: { columns, rows, totalRows, page, perPage, totalPages }
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { read, utils } from 'xlsx';
import type { WorkSheet } from 'xlsx';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function getClient() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');
  return new PrismaClient({ datasources: { db: { url } } });
}

// ── Header row detection (mirrors the logic in workbook-analyzer.ts) ─────────

const HEADER_KEYWORDS = /description|amount|total|date|revenue|account|name|qty|price|cost|sales|income|expense|balance|number|ref|period|transaction|debit|credit|unit|rate|pct|margin|bills|covers|guests|staff|code|type|category|item|product|service|charge|discount|tax|subtotal|net|gross/i;
const TITLE_KEYWORDS = /^(profit\s*&?\s*loss|balance\s*sheet|trial\s*balance|general\s*ledger|periode|period|month\s*of|input\s*data|auto\s*calc)/i;

function findHeaderRow(ws: WorkSheet): { headerRow: number; headers: string[] } {
  const rows = utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const maxScan = Math.min(rows.length, 20);

  let bestRow = 0;
  let bestScore = 0;
  let bestHeaders: string[] = [];

  for (let i = 0; i < maxScan; i++) {
    const row = rows[i] ?? [];
    const nonEmpty = row.filter((c) => c !== '' && c !== undefined && c !== null) as unknown[];
    const nonEmptyCount = nonEmpty.length;
    if (nonEmptyCount === 0) continue;

    // Skip title rows (single long text with title keywords)
    const firstCell = String(row[0] ?? '').trim();
    if (nonEmptyCount <= 2 && TITLE_KEYWORDS.test(firstCell)) continue;

    let headerLikeCount = 0;
    let numericCount = 0;
    for (const cell of nonEmpty) {
      const str = String(cell);
      if (str === '#N/A' || str === '#REF!' || str === '#VALUE!') continue;
      const num = Number(cell);
      const isNumeric = typeof cell === 'number' || (typeof cell === 'string' && /^[\d,.\-]+$/.test(str.trim()) && isFinite(num));
      if (isNumeric && Math.abs(num) > 0) numericCount++;
      else if (HEADER_KEYWORDS.test(str)) headerLikeCount++;
    }

    const textRatio = nonEmptyCount > 0 ? (nonEmptyCount - numericCount) / nonEmptyCount : 0;
    const score = headerLikeCount * 3 + textRatio * 2 + (nonEmptyCount >= 3 ? 1 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestRow = i;
      bestHeaders = row.map((c) => String(c ?? ''));
    }
  }

  if (bestScore < 2 && rows.length > 0) {
    const firstRow = (rows[0] ?? []).map((c) => String(c ?? ''));
    return { headerRow: 1, headers: firstRow };
  }

  return { headerRow: bestRow + 1, headers: bestHeaders };
}

// ── GET handler ─────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const sheetName = searchParams.get('sheet');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(1000, Math.max(1, parseInt(searchParams.get('perPage') ?? '200', 10)));

  if (!sheetName) {
    return NextResponse.json({ error: 'Query param "sheet" is required (e.g. ?sheet=PL)' }, { status: 400 });
  }

  const prisma = getClient();
  try {
    const cached = await prisma.knowledgeSnippet.findUnique({
      where: { key: 'workbook_data' },
    });
    if (!cached?.content) {
      return NextResponse.json({ error: 'No workbook cached. Upload the workbook via Config > Source first.' }, { status: 404 });
    }

    const buf = Buffer.from(cached.content, 'base64');
    const wb = read(buf, { type: 'buffer' });

    const tabName = wb.SheetNames.find((n) => n.toLowerCase() === sheetName.toLowerCase());
    if (!tabName) {
      return NextResponse.json({
        error: `Sheet "${sheetName}" not found`,
        availableSheets: wb.SheetNames,
      }, { status: 404 });
    }

    const ws = wb.Sheets[tabName]!;

    // Detect the correct header row
    const { headerRow, headers } = findHeaderRow(ws);

    // Build a clean column key array — deduplicate names, replace empty headers
    // with unique placeholder keys (_col_0, _col_1, ...) that are filtered out later.
    // This avoids MUI DataGrid error #83 ("column with field X does not exist")
    // caused by duplicate or empty column field names.
    const seen = new Map<string, number>();
    let emptyColIdx = 0;
    const columnKeys = headers.map((h) => {
      const trimmed = h.trim();
      if (!trimmed) return `__hidden_${emptyColIdx++}`; // placeholder key, filtered out below
      const count = seen.get(trimmed) ?? 0;
      seen.set(trimmed, count + 1);
      return count > 0 ? `${trimmed}_${count}` : trimmed;
    });
    const columns = columnKeys.filter((k) => !k.startsWith('__hidden_'));

    // Parse data using deduplicated / placeholder column keys.
    const allRows = utils.sheet_to_json<Record<string, unknown>>(ws, {
      header: columnKeys,
      defval: '',
    });

    // Remove rows that are empty or are metadata/header artifacts.
    // The xlsx parser includes the header row itself as the first data row,
    // plus any #N/A rows and empty metadata rows.
    const dataRows = allRows.filter((row) => {
      // Count non-empty values
      const filled = Object.entries(row).filter(([, v]) => v !== '' && v !== undefined && v !== null);
      // Skip rows that are entirely empty or only have #N/A
      const naOnly = filled.every(([, v]) => String(v) === '#N/A');
      if (filled.length === 0 || naOnly) return false;
      // Skip rows where ALL values match the header values (the header row itself being repeated)
      const isHeader = filled.length === columns.length && columns.every((c) => String(row[c] ?? '') === c);
      return !isHeader;
    });

    const totalRows = dataRows.length;
    const totalPages = Math.ceil(totalRows / perPage);

    // Slice to requested page
    const startIdx = (page - 1) * perPage;
    const rows = dataRows.slice(startIdx, startIdx + perPage);

    return NextResponse.json({
      sheet: tabName,
      headerRow,
      columns,
      rows,
      totalRows,
      returnedRows: rows.length,
      page,
      perPage,
      totalPages,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
