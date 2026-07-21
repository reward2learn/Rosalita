/**
 * Workbook Analyzer
 *
 * Reads any Excel workbook and produces a structured analysis of every sheet:
 * tab names, column headers, row counts, data patterns, and detected table types.
 *
 * This analysis is used by the reseed pipeline to:
 *   1. Dynamically generate navigation pages mirroring the workbook structure
 *   2. Configure appropriate visualisation blocks (table, chart, KPI card)
 *   3. Store sheet metadata so the AI chat can reference live workbook data
 *   4. Generate use-case descriptions for each logical report
 */

import * as XLSX from 'xlsx';
import type { WorkBook, WorkSheet } from 'xlsx';

// ── Types ──────────────────────────────────────────────

export type SheetCategory =
  | 'daily_sales'
  | 'profit_loss'
  | 'balance_sheet'
  | 'trial_balance'
  | 'general_ledger'
  | 'cost_of_sales'
  | 'month_on_month'
  | 'break_even'
  | 'variance'
  | 'summary_pl'
  | 'summary_bs'
  | 'unknown';

export interface ColumnInfo {
  /** Column header label (first non-empty row) */
  label: string;
  /** 1-based column index */
  index: number;
  /** Guessed data type based on sample values */
  dataType: 'string' | 'number' | 'date' | 'amount' | 'pct' | 'idr' | 'unknown';
  /** Sample non-empty values (up to 3) */
  samples: (string | number)[];
}

export interface SheetAnalysis {
  /** Raw tab name as it appears in Excel */
  tabName: string;
  /** Normalised slug for URL / route generation */
  slug: string;
  /** Categorised sheet type */
  category: SheetCategory;
  /** Detected human-readable title */
  title: string;
  /** Column headers (first meaningful row) */
  columns: ColumnInfo[];
  /** Total data rows (excluding header) */
  rowCount: number;
  /** Total columns */
  columnCount: number;
  /** Sample rows (up to 5) for preview */
  sampleRows: Record<string, unknown>[];
  /** Whether this sheet has financial amount columns */
  hasFinancialData: boolean;
  /** Year-over-year indicators found */
  hasMultiYearData: boolean;
  /** Detectable period labels found in headers */
  periods: string[];
}

export interface WorkbookAnalysis {
  /** Original filename */
  fileName: string;
  /** Company name if detectable */
  company: string;
  /** Period if detectable */
  period: string;
  /** Total sheets */
  sheetCount: number;
  /** Analyses per sheet */
  sheets: SheetAnalysis[];
  /** Aggregate categories found */
  categoriesFound: SheetCategory[];
  /** Overall assessment */
  summary: string;
}

// ── Category detection ──────────────────────────────────

const TAB_PATTERNS: [RegExp, SheetCategory, string][] = [
  [/^daily\s*sales|daily/i, 'daily_sales', 'Daily Sales'],
  [/^pl$|profit.*loss|^p&l$/i, 'profit_loss', 'Profit & Loss'],
  [/^bs$|balance.*sheet/i, 'balance_sheet', 'Balance Sheet'],
  [/^tb$|trial.*balance/i, 'trial_balance', 'Trial Balance'],
  [/^gl$|general.*ledger/i, 'general_ledger', 'General Ledger'],
  [/^cos$|cost.*of.*sales/i, 'cost_of_sales', 'Cost of Sales'],
  [/^month.*on.*month|^mom$/i, 'month_on_month', 'Month on Month'],
  [/^bep$|break.?even/i, 'break_even', 'Break-Even Analysis'],
  [/^variance|monthly.*variance/i, 'variance', 'Monthly Variance'],
  [/^sumpl|summary.*pl|sum.*p.*l/i, 'summary_pl', 'Summary P&L'],
  [/^sumbs|summary.*bs|sum.*b.*s/i, 'summary_bs', 'Summary Balance Sheet'],
];

function detectCategory(tabName: string): { category: SheetCategory; title: string } {
  for (const [regex, cat, title] of TAB_PATTERNS) {
    if (regex.test(tabName.trim())) {
      return { category: cat, title };
    }
  }
  return { category: 'unknown', title: tabName };
}

function normalizeSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[&]/g, 'and')
    .replace(/[\s]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Column analysis ─────────────────────────────────────

function guessDataType(
  label: string,
  sampleValues: unknown[],
): ColumnInfo['dataType'] {
  const labelLower = label.toLowerCase();

  if (
    /amount|total|sales|revenue|income|cost|expense|balance|value|price|sum/i.test(
      labelLower,
    )
  ) {
    return 'idr';
  }
  if (/pct|margin|rate|%/i.test(labelLower)) return 'pct';
  if (/date|period|month|year/i.test(labelLower)) return 'date';
  if (/qty|count|number|no\.|covers|bills|guests|staff/i.test(labelLower))
    return 'number';

  // Check sample values
  const numericSamples = sampleValues.filter(
    (v): v is number | string =>
      typeof v === 'number' || (typeof v === 'string' && /^[\d,.\-]+$/.test(v.trim())),
  );
  if (numericSamples.length > sampleValues.length / 2) {
    const numericValues = numericSamples.map((v) => Number(v));
    const avg = numericValues.reduce((s, v) => s + v, 0) / numericValues.length;
    if (avg > 1_000_000) return 'idr';
    if (avg > 100) return 'number';
    return 'amount';
  }

  return 'string';
}

function findHeaderRow(ws: WorkSheet): { headerRow: number; headers: string[] } {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i] ?? [];
    const nonEmpty = row.filter((c) => c !== '' && c !== undefined && c !== null);
    // A header row typically has 3+ non-empty cells and contains label-like text
    if (
      nonEmpty.length >= 3 &&
      nonEmpty.some((c) => /description|amount|total|date|revenue|account|name/i.test(String(c)))
    ) {
      return { headerRow: i + 1, headers: row.map((c) => String(c ?? '')) };
    }
  }
  // Fallback: treat first row as header if it has any text content
  const firstRow = (rows[0] ?? []).map((c) => String(c ?? ''));
  return { headerRow: 1, headers: firstRow };
}

// ── Date/period extraction ──────────────────────────────

function extractPeriods(
  headers: string[],
  sampleValues: (unknown[] | undefined)[],
): string[] {
  const periods: string[] = [];

  for (const h of headers) {
    const hStr = String(h ?? '');
    // Match "YYYY-MM-DD" or "YYYY-MM" or "MM/DD/YYYY" or "Jan 2026" etc.
    const dateMatch = hStr.match(
      /(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?|(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})/i,
    );
    if (dateMatch) {
      periods.push(hStr);
    }
  }

  // Also check first data row for date values
  if (periods.length === 0 && sampleValues.length > 0) {
    for (let c = 0; c < Math.min(headers.length, 10); c++) {
      const sample = sampleValues[0]?.[c];
      if (sample instanceof Date || (typeof sample === 'number' && sample > 40000 && sample < 100000)) {
        const excelDate =
          sample instanceof Date
            ? sample
            : new Date(Math.round((sample - 25569) * 86400 * 1000));
        const ds = excelDate.toISOString().slice(0, 7);
        if (!periods.includes(ds)) periods.push(ds);
      }
    }
  }

  return periods;
}

// ── Data sample extraction ──────────────────────────────

function extractSampleRows(
  ws: WorkSheet,
  headerRow: number,
  maxSamples = 5,
): Record<string, unknown>[] {
  const json = XLSX.utils.sheet_to_json(ws, {
    defval: '',
    header: 1,
  }) as unknown[][];

  const dataRows = json.slice(headerRow).filter((row: unknown[]) =>
    row.some((c: unknown) => c !== '' && c !== undefined && c !== null),
  ) as unknown[][];

  return dataRows.slice(0, maxSamples).map((row: unknown[]) => {
    const obj: Record<string, unknown> = {};
    row.forEach((val, idx) => {
      obj[`col_${idx + 1}`] = val;
    });
    return obj;
  });
}

// ── Sheet analysis ──────────────────────────────────────

function analyzeSheet(
  ws: WorkSheet,
  tabName: string,
): SheetAnalysis {
  const { headerRow, headers } = findHeaderRow(ws);
  const { category, title } = detectCategory(tabName);

  // Extract all data as rows for column sampling
  const allRows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as unknown[][];
  const dataRows = allRows.slice(headerRow).filter((r: unknown[]) =>
    r.some((c: unknown) => c !== '' && c !== undefined && c !== null),
  );

  const columnCount = Math.max(
    ...dataRows.map((r: unknown[]) => r.length),
    headers.length,
    1,
  );
  const rowCount = dataRows.length;

  // Build column info
  const columns: ColumnInfo[] = [];
  for (let c = 0; c < columnCount; c++) {
    const label = String(headers[c] ?? `Column ${c + 1}`);
    const samples: unknown[] = [];
    for (let r = 0; r < Math.min(dataRows.length, 10); r++) {
      const val = (dataRows[r] as unknown[])[c];
      if (val !== '' && val !== undefined && val !== null) {
        samples.push(val);
        if (samples.length >= 3) break;
      }
    }
    columns.push({
      label,
      index: c + 1,
      dataType: guessDataType(label, samples),
      samples: samples as (string | number)[],
    });
  }

  const hasFinancialData = columns.some(
    (c) => c.dataType === 'idr' || c.dataType === 'amount',
  );
  const periods = extractPeriods(headers, dataRows.slice(0, 3));

  const sampleRows = extractSampleRows(ws, headerRow);

  return {
    tabName,
    slug: normalizeSlug(tabName),
    category,
    title,
    columns,
    rowCount,
    columnCount,
    sampleRows,
    hasFinancialData,
    hasMultiYearData: periods.length > 12 || category === 'summary_pl' || category === 'summary_bs',
    periods,
  };
}

// ── Company / period detection ──────────────────────────

function detectHeaderInfo(ws: WorkSheet): { company: string; period: string } {
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  let company = '';
  let period = '';

  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const row = rows[i] ?? [];
    const text = row.filter(Boolean).join(' ');
    const companyMatch = text.match(/PT\s+[\w\s]+/i);
    if (companyMatch) company = companyMatch[0].trim();
    const periodMatch = text.match(
      /(?:periode|month|period|per)\s*(?:\sof\s+)?(\w+\s+\d{4})/i,
    );
    if (periodMatch) period = periodMatch[1];
    // Also try "MONTH OF <text>"
    const monthOfMatch = text.match(/MONTH OF\s+(.+)/i);
    if (monthOfMatch && !period) period = monthOfMatch[1].trim();
  }

  return { company, period };
}

// ── Main analyzer ───────────────────────────────────────

export function analyzeWorkbook(
  data: Buffer | ArrayBuffer | Uint8Array,
  fileName = 'workbook.xlsx',
): WorkbookAnalysis {
  const wb = XLSX.read(data, { type: 'buffer' });
  const sheetNames = wb.SheetNames;

  // Detect company/period from first sheet
  const firstSheet = wb.Sheets[sheetNames[0] ?? ''];
  const { company, period } = firstSheet
    ? detectHeaderInfo(firstSheet)
    : { company: '', period: '' };

  const sheets: SheetAnalysis[] = [];
  const categoriesFound = new Set<SheetCategory>();

  for (const name of sheetNames) {
    const ws = wb.Sheets[name];
    if (!ws) continue;
    const analysis = analyzeSheet(ws, name);
    sheets.push(analysis);
    categoriesFound.add(analysis.category);
  }

  const summary = buildSummary(sheets, company, period, fileName);

  return {
    fileName,
    company,
    period,
    sheetCount: sheets.length,
    sheets,
    categoriesFound: Array.from(categoriesFound),
    summary,
  };
}

// ── Summary builder ─────────────────────────────────────

function buildSummary(
  sheets: SheetAnalysis[],
  company: string,
  period: string,
  fileName: string,
): string {
  const parts: string[] = [
    `Workbook: ${fileName}`,
    company ? `Company: ${company}` : '',
    period ? `Period: ${period}` : '',
    `Sheets: ${sheets.length}`,
    '',
    'Sheets detected:',
  ];

  for (const s of sheets) {
    const financialTag = s.hasFinancialData ? ' [financial]' : '';
    const multiYearTag = s.hasMultiYearData ? ' [multi-year]' : '';
    const periodTag = s.periods.length ? ` (periods: ${s.periods.slice(0, 3).join(', ')}${s.periods.length > 3 ? '...' : ''})` : '';
    parts.push(
      `  - ${s.tabName} → "${s.title}"${financialTag}${multiYearTag}${periodTag}`,
    );
    parts.push(
      `    ${s.columns.length} columns, ${s.rowCount} data rows`,
    );
  }

  // Use-case generation
  parts.push('');
  parts.push('Use cases derived from workbook structure:');
  for (const s of sheets) {
    const uc = deriveUseCase(s);
    if (uc) parts.push(`  - ${uc}`);
  }

  return parts.join('\n');
}

function deriveUseCase(sheet: SheetAnalysis): string | null {
  const map: Record<SheetCategory, string> = {
    daily_sales: 'Track daily revenue by category (Terrace, Club) with spend-per-guest metrics',
    profit_loss: 'View profit & loss statement with all revenue and expense lines',
    balance_sheet: 'Review balance sheet — assets, liabilities, and equity positions',
    trial_balance: 'Audit trial balance with MTD and YTD account summaries',
    general_ledger: 'Browse general ledger transactions by date and account',
    cost_of_sales: 'Analyse cost of sales breakdown by inventory category',
    month_on_month: 'Compare revenue and expense line items against the prior month',
    break_even: 'Monitor break-even point coverage and fixed-cost structure over time',
    variance: 'Review monthly variance between actual results and prior period',
    summary_pl: 'View multi-year profit & loss trends for strategic planning',
    summary_bs: 'Track multi-year balance sheet evolution and liquidity trends',
    unknown: `View "${sheet.tabName}" data table with ${sheet.columns.length} metrics`,
  };
  return map[sheet.category] ?? null;
}

// ── Dynamic page generation ─────────────────────────────

import type { PageDefinition, PageSectionDefinition } from '@/lib/page-catalog';

/**
 * Generate dynamic page catalog entries from workbook analysis.
 * Each sheet with meaningful data gets its own page + nav entry.
 */
export function generatePagesFromAnalysis(
  analysis: WorkbookAnalysis,
): PageDefinition[] {
  const pages: PageDefinition[] = [];

  // Overview page listing all sheets
  pages.push({
    slug: 'workbook',
    title: 'Workbook Overview',
    authTier: 'google',
    navLabel: 'Workbook',
    showInNav: true,
    sections: [
      {
        blockType: 'doc_markdown',
        config: {
          source: 'workbook-summary',
          title: `Workbook: ${analysis.fileName}`,
        },
      },
    ],
  });

  // One page per sheet with meaningful data
  for (const sheet of analysis.sheets) {
    if (sheet.columns.length < 2) continue;

    const slug = `sheet-${sheet.slug}`;
    const sections: PageSectionDefinition[] = [];

    // Add a doc_markdown section with sheet description
    sections.push({
      blockType: 'doc_markdown',
      config: {
        source: `sheet-${sheet.slug}`,
        title: sheet.title,
      },
    });

    // Add a reports_rollup block for financial sheets
    if (sheet.hasFinancialData) {
      sections.push({
        blockType: 'reports_rollup',
        config: {
          sheet: sheet.tabName,
          columns: sheet.columns.map((c) => c.label),
          title: sheet.title,
        },
      });
    }

    pages.push({
      slug,
      title: sheet.title,
      authTier: 'google',
      navLabel: sheet.title.length > 25 ? sheet.title.slice(0, 24) + '…' : sheet.title,
      showInNav: true,
      sections,
    });
  }

  return pages;
}

/**
 * Generate a markdown summary from the workbook analysis that can be stored
 * as a knowledge snippet for the AI chat context.
 */
export function generateAnalysisMarkdown(analysis: WorkbookAnalysis): string {
  const lines: string[] = [
    `# Workbook Analysis: ${analysis.fileName}`,
    ``,
  ];

  if (analysis.company) lines.push(`**Company:** ${analysis.company}`);
  if (analysis.period) lines.push(`**Period:** ${analysis.period}`);
  lines.push(`**Sheets:** ${analysis.sheetCount}`);
  lines.push(``);

  for (const sheet of analysis.sheets) {
    lines.push(`## ${sheet.tabName} — ${sheet.title}`);
    lines.push(``);
    lines.push(`| Column | Type | Sample Values |`);
    lines.push(`|--------|------|---------------|`);
    for (const col of sheet.columns.slice(0, 10)) {
      const samples = col.samples
        .map((s) => String(s).slice(0, 20))
        .join(', ');
      lines.push(`| ${col.label} | ${col.dataType} | ${samples || '—'} |`);
    }
    if (sheet.columns.length > 10) {
      lines.push(`| *... and ${sheet.columns.length - 10} more columns* | | |`);
    }
    lines.push(``);
    lines.push(`Rows: ${sheet.rowCount}`);
    if (sheet.periods.length) {
      lines.push(`Periods: ${sheet.periods.join(', ')}`);
    }
    lines.push(``);
  }

  return lines.join('\n');
}
