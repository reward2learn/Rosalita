/**
 * Excel Workbook Extractor
 *
 * Reads the Red Ruby PT Taman Bintang Bali workbook and returns structured
 * financial data for AI prompt generation.
 *
 * Sheets extracted:
 *   Daily Sales – daily revenue by category
 *   PL – profit & loss statement
 *   BS – balance sheet
 *   Month on Month – MoM comparison
 *   BEP Monthly – break-even point by month
 *   Monthly Variance – variance analysis
 *   SUMPL – multi-year P&L summary
 *   SumBS – multi-year balance sheet summary
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';

// ── Types ──────────────────────────────────────────────

export interface DailySalesRow {
  accountCode: string;
  description: string;
  dailyValues: Record<string, number>;
}

export interface PlLine {
  accountCode: string;
  description: string;
  amount: number;
  pct?: number;
}

export interface MonthOnMonthLine {
  description: string;
  previousMonth: number;
  currentMonth: number;
  changePct: number;
}

export interface BepMonthlyRow {
  period: string;
  totalRevenue: number;
  totalCos: number;
  totalPayroll: number;
  otherFixedCost: number;
  grossMarginPct: number;
  totalFixedCost: number;
  bepRevenue: number;
  bepCoverage: number;
}

export interface MonthlyVarianceRow {
  item: string;
  mayValue: number;
  juneValue: number;
  variance: number;
  variancePct: number;
}

export interface SummaryPlYear {
  year: string;
  lines: { description: string; amount: number }[];
}

export interface ExcelData {
  workbookName: string;
  period: string;
  company: string;
  dailySales: {
    terraceRevenue: DailySalesRow[];
    clubRevenue: DailySalesRow[];
    totals: Record<string, number>;
    spendPerGuest: Record<string, number>;
  };
  profitAndLoss: PlLine[];
  balanceSheet: { description: string; amount: number }[];
  monthOnMonth: MonthOnMonthLine[];
  bepMonthly: BepMonthlyRow[];
  monthlyVariance: MonthlyVarianceRow[];
  summaryPl: SummaryPlYear[];
}

// ── Helpers ─────────────────────────────────────────────

function workbookPath(): string {
  const candidates = [
    resolve(process.cwd(), '../June 2026 - Red Ruby PT.TAMAN BINTANG BALI.xlsx'),
    resolve(process.cwd(), 'June 2026 - Red Ruby PT.TAMAN BINTANG BALI.xlsx'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return candidates[0];
}

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.\-]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toDateStr(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v.slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  // Excel serial date number
  if (typeof v === 'number') {
    const d = new Date((v - 25569) * 86400 * 1000);
    return d.toISOString().slice(0, 10);
  }
  return String(v).slice(0, 10);
}

function periodFromDateStr(s: string): string {
  return s ? s.slice(0, 7) : '';
}

// ── Sheet extractors ────────────────────────────────────

function extractPl(ws: XLSX.WorkSheet): PlLine[] {
  const lines: PlLine[] = [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });
  let inIncome = false;
  let inCos = false;
  let inExpenses = false;

  for (const row of rows) {
    const cells = row as unknown as unknown[];
    const b = String(cells[1] ?? '').trim();
    const c = String(cells[2] ?? '').trim();
    const d = cells[3];

    if (b === '4-0000' && c === 'INCOME') { inIncome = true; continue; }
    if (b === '5-0000' && c === 'Cost Of Sales') { inIncome = false; inCos = true; continue; }
    if (b === '6-0000' && c === 'EXPENSES') { inCos = false; continue; }
    if (b === '4-9999') {
      lines.push({ accountCode: b, description: 'Total Income', amount: toNumber(d) });
      continue;
    }
    if (b === '5-9999') {
      lines.push({ accountCode: b, description: 'Total Cost Of Sales', amount: toNumber(d) });
      continue;
    }

    if ((inIncome || inCos) && b && c) {
      const amount = toNumber(d);
      if (amount !== 0) {
        lines.push({ accountCode: b, description: c, amount });
      }
    }
  }
  return lines;
}

function extractBs(ws: XLSX.WorkSheet): { description: string; amount: number }[] {
  const items: { description: string; amount: number }[] = [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });
  for (const row of rows) {
    const cells = row as unknown as unknown[];
    const c = String(cells[2] ?? '').trim();
    const d = cells[3];
    if (c && d) {
      const amount = toNumber(d);
      if (amount !== 0) {
        items.push({ description: c, amount });
      }
    }
  }
  return items;
}

function extractMonthlyVariance(ws: XLSX.WorkSheet): MonthlyVarianceRow[] {
  const rows: MonthlyVarianceRow[] = [];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
  for (const row of json) {
    const item = String(row['Item'] ?? '').trim();
    if (!item || item === 'Item') continue;
    rows.push({
      item,
      mayValue: toNumber(row['May 2026']),
      juneValue: toNumber(row['__EMPTY'] ?? row['Jun 2026'] ?? ''),
      variance: toNumber(row['Variance']),
      variancePct: toNumber(row['Variance %']),
    });
  }
  return rows;
}

function extractBepMonthly(ws: XLSX.WorkSheet): BepMonthlyRow[] {
  // BEP sheet has a complex layout with monthly columns
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });
  const bepRows: BepMonthlyRow[] = [];

  // Find header row with dates (row 3 in the sheet)
  let headerRow: unknown[] = [];
  let dataStartIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown as unknown[];
    if (String(r[0] ?? '').includes('INPUT DATA')) {
      headerRow = r;
      dataStartIdx = i + 1;
      break;
    }
  }

  // Extract by looking for known labels
  let totalRevenue: (number | null)[] = [];
  let totalCos: (number | null)[] = [];
  let totalPayroll: (number | null)[] = [];
  let otherFixedCost: (number | null)[] = [];
  let grossMarginPct: (number | null)[] = [];
  let totalFixedCost: (number | null)[] = [];
  let bepRevenue: (number | null)[] = [];
  let bepCoverage: (number | null)[] = [];
  let periods: string[] = [];

  for (const row of rows) {
    const r = row as unknown as unknown[];
    const label = String(r[0] ?? '').trim();
    const vals: (number | null)[] = [];

    // Collect values from column B onwards (index 1)
    for (let c = 1; c < r.length; c++) {
      const v = toNumber(r[c]);
      vals.push(v !== 0 ? v : null);
    }

    if (label === 'Total Revenue') { totalRevenue = vals; }
    else if (label === 'Total Cost of Sales') { totalCos = vals; }
    else if (label === 'Total Payroll') { totalPayroll = vals; }
    else if (label === 'Other Fixed Cost') { otherFixedCost = vals; }
    else if (label === 'Gross Margin %') { grossMarginPct = vals; }
    else if (label === 'Total Fixed Cost') { totalFixedCost = vals; }
    else if (label === 'BEP Revenue') { bepRevenue = vals; }
    else if (label === 'BEP Coverage ') { bepCoverage = vals; }
  }

  // Extract period labels from header row
  for (let c = 1; c < headerRow.length; c++) {
    const h = headerRow[c];
    if (h) {
      const ds = toDateStr(h);
      if (ds) periods.push(periodFromDateStr(ds));
      else periods.push(String(h).trim());
    } else {
      periods.push('');
    }
  }

  // Build BEP rows
  const maxLen = Math.max(
    totalRevenue.length, totalCos.length, totalPayroll.length,
    otherFixedCost.length, grossMarginPct.length, totalFixedCost.length,
    bepRevenue.length, bepCoverage.length,
  );

  for (let i = 0; i < maxLen && i < periods.length; i++) {
    if (!periods[i]) continue;
    bepRows.push({
      period: periods[i],
      totalRevenue: totalRevenue[i] ?? 0,
      totalCos: totalCos[i] ?? 0,
      totalPayroll: totalPayroll[i] ?? 0,
      otherFixedCost: otherFixedCost[i] ?? 0,
      grossMarginPct: grossMarginPct[i] ?? 0,
      totalFixedCost: totalFixedCost[i] ?? 0,
      bepRevenue: bepRevenue[i] ?? 0,
      bepCoverage: bepCoverage[i] ?? 0,
    });
  }

  return bepRows;
}

function extractDailySales(ws: XLSX.WorkSheet): ExcelData['dailySales'] {
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });
  const terraceRevenue: DailySalesRow[] = [];
  const clubRevenue: DailySalesRow[] = [];
  const totals: Record<string, number> = {};
  const spendPerGuest: Record<string, number> = {};

  let inTerrace = false;
  let inClub = false;
  let currentSection: 'terrace' | 'club' | null = null;

  for (const row of rows) {
    const r = row as unknown as unknown[];
    const b = String(r[1] ?? '').trim();

    if (b === 'Terrace Revenue:') { currentSection = 'terrace'; inTerrace = true; inClub = false; continue; }
    if (b === 'Club Revenue:') { currentSection = 'club'; inTerrace = false; inClub = true; continue; }
    if (b === 'Total Terrace Revenue') {
      // Collect totals from column C onwards
      for (let c = 2; c < r.length; c++) {
        const dayKey = `day-${c - 1}`;
        totals[dayKey] = toNumber(r[c]);
      }
      continue;
    }
    if (b === 'Spend per Guest') {
      for (let c = 2; c < r.length; c++) {
        const dayKey = `day-${c - 1}`;
        spendPerGuest[dayKey] = toNumber(r[c]);
      }
      continue;
    }

    // Revenue rows within sections
    if (currentSection && b && r[2] !== undefined) {
      const rowData: DailySalesRow = {
        accountCode: String(r[0] ?? '').trim(),
        description: b,
        dailyValues: {},
      };
      for (let c = 2; c < r.length; c++) {
        const dayKey = `day-${c - 1}`;
        rowData.dailyValues[dayKey] = toNumber(r[c]);
      }
      if (currentSection === 'terrace') terraceRevenue.push(rowData);
      else clubRevenue.push(rowData);
    }
  }

  return { terraceRevenue, clubRevenue, totals, spendPerGuest };
}

function extractMonthOnMonth(ws: XLSX.WorkSheet): MonthOnMonthLine[] {
  const lines: MonthOnMonthLine[] = [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });
  for (const row of rows) {
    const r = row as unknown as unknown[];
    const c = String(r[2] ?? '').trim();
    if (!c || c === 'DESCRIPTION') continue;
    const prev = toNumber(r[3]);
    const curr = toNumber(r[5]);
    if (prev === 0 && curr === 0) continue;
    lines.push({
      description: c,
      previousMonth: prev,
      currentMonth: curr,
      changePct: toNumber(r[7]),
    });
  }
  return lines;
}

function extractSummaryPl(ws: XLSX.WorkSheet): SummaryPlYear[] {
  const years: SummaryPlYear[] = [];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' });

  // Find header row (row 3 in the sheet, 0-indexed)
  let headerRowIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i] as unknown as unknown[];
    if (String(r[2] ?? '').trim() === 'DESCRIPTION') {
      headerRowIdx = i;
      break;
    }
  }
  if (headerRowIdx === -1) return [];

  const headerRow = rows[headerRowIdx] as unknown as unknown[];
  const yearCols: { colIdx: number; year: string }[] = [];
  for (let c = 3; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? '').trim();
    if (h && /^\d{4}$/.test(h)) {
      yearCols.push({ colIdx: c, year: h });
    }
  }

  // Map year column indices
  for (const yc of yearCols) {
    const lines: { description: string; amount: number }[] = [];
    for (let r = headerRowIdx + 2; r < rows.length; r++) {
      const row = rows[r] as unknown as unknown[];
      const desc = String(row[2] ?? '').trim();
      if (!desc || row[yc.colIdx] === undefined) continue;
      const amount = toNumber(row[yc.colIdx]);
      if (amount !== 0) {
        lines.push({ description: desc, amount });
      }
    }
    years.push({ year: yc.year, lines });
  }

  return years;
}

// ── Main extractor ──────────────────────────────────────

/**
 * Extract structured data from the June 2026 Red Ruby workbook.
 *
 * @param source  Optional explicit file path (string) or in-memory Buffer.
 *                When omitted, auto-detects the file on disk.
 *                When a Buffer is provided the file-system is bypassed
 *                (useful on serverless runtimes where the workbook was
 *                uploaded and is held in memory).
 */
export function extractExcelData(source?: string | Buffer): ExcelData {
  let buf: Buffer;

  let workbookSourceName = 'workbook.xlsx';

  if (Buffer.isBuffer(source)) {
    buf = source;
    workbookSourceName = 'in-memory workbook buffer';
  } else if (typeof source === 'string') {
    if (!existsSync(source)) {
      throw new Error(`Workbook not found at: ${source}`);
    }
    buf = readFileSync(source);
    workbookSourceName = source.split('/').pop() ?? source;
  } else {
    const diskPath = workbookPath();
    if (!existsSync(diskPath)) {
      throw new Error(
        'Workbook file not found on disk and no data buffer provided. ' +
        'Upload the workbook via the Config page first, then use the AI Content Generation tab.'
      );
    }
    buf = readFileSync(diskPath);
    workbookSourceName = diskPath.split('/').pop() ?? 'Unknown';
  }

  const wb = XLSX.read(buf, { type: 'buffer' });

  const data: ExcelData = {
    workbookName: workbookSourceName,
    period: 'June 2026',
    company: 'PT Taman Bintang Bali',
    dailySales: { terraceRevenue: [], clubRevenue: [], totals: {}, spendPerGuest: {} },
    profitAndLoss: [],
    balanceSheet: [],
    monthOnMonth: [],
    bepMonthly: [],
    monthlyVariance: [],
    summaryPl: [],
  };

  // Extract each sheet by name
  if (wb.SheetNames.includes('PL')) {
    data.profitAndLoss = extractPl(wb.Sheets['PL']);
  }
  if (wb.SheetNames.includes('BS')) {
    data.balanceSheet = extractBs(wb.Sheets['BS']);
  }
  if (wb.SheetNames.includes('Daily Sales')) {
    data.dailySales = extractDailySales(wb.Sheets['Daily Sales']);
  }
  if (wb.SheetNames.includes('Monthly Variance')) {
    data.monthlyVariance = extractMonthlyVariance(wb.Sheets['Monthly Variance']);
  }
  if (wb.SheetNames.includes('BEP Monthly')) {
    data.bepMonthly = extractBepMonthly(wb.Sheets['BEP Monthly']);
  }
  if (wb.SheetNames.includes('Month on Month')) {
    data.monthOnMonth = extractMonthOnMonth(wb.Sheets['Month on Month']);
  }
  if (wb.SheetNames.includes('SUMPL')) {
    data.summaryPl = extractSummaryPl(wb.Sheets['SUMPL']);
  }

  return data;
}
