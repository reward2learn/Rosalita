/**
 * Parse financial projections from Cashflow Excel — ported from load_financial_data.mjs.
 */
import XLSX from 'xlsx';
import type { WorkSheet } from 'xlsx';
import { layoutForSheet, PNL_LINE_ITEMS, rowForItem } from './pnl-rows.js';

export type ProjectionDataType = 'actual' | 'forecast';
export type ProjectionScenario = 'actual' | 'conservative' | 'realistic' | 'aspirational';

export interface PnlLine {
  key: string;
  label: string;
  value: number | null;
  pct?: boolean;
  sub?: boolean;
  header?: boolean;
}

export interface FinancialProjectionRow {
  period: string;
  year: number;
  month: number;
  dataType: ProjectionDataType;
  scenario: ProjectionScenario;
  revenue: number;
  ebitda: number;
  netIncome: number;
  guests: number;
  staffCost: number;
  pnlLines: PnlLine[];
}

interface SheetConfig {
  ebitda: number;
  revenue: number | { actual: number; forecast: number };
  guests: number | { actual: number; forecast: number };
  netIncome: number | { actual: number; forecast: number };
}

const SHEET_CONFIG: Record<string, SheetConfig> = {
  Rosalita: {
    ebitda: 84,
    revenue: { actual: 29, forecast: 27 },
    guests: { actual: 23, forecast: 22 },
    netIncome: { actual: 18, forecast: 16 },
  },
  '2027': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
  },
  '2029': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
  },
  '2030': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
  },
};

function getCell(sheet: WorkSheet, col: number, row: number): unknown {
  const addr = XLSX.utils.encode_cell({ c: col - 1, r: row - 1 });
  const cell = sheet[addr];
  return cell ? cell.v : null;
}

function getStaffCost(sheet: WorkSheet, col: number, sheetName: string): number {
  const costRows =
    sheetName === 'Rosalita' ? [45, 47, 49, 51, 53, 55, 57, 58] : [35, 37, 39, 41, 43, 44];
  let total = 0;
  for (const r of costRows) {
    const v = getCell(sheet, col, r);
    if (v != null && typeof v === 'number' && !Number.isNaN(v)) total += v;
  }
  return total;
}

function pickRow(
  cfg: number | { actual: number; forecast: number },
  dataType: ProjectionDataType,
): number {
  return typeof cfg === 'object' ? cfg[dataType === 'actual' ? 'actual' : 'forecast'] : cfg;
}

function extractPnlLines(sheet: WorkSheet, col: number, sheetName: string): PnlLine[] {
  const layout = layoutForSheet(sheetName);
  const lines: PnlLine[] = [];
  for (const item of PNL_LINE_ITEMS) {
    if (item.header) {
      lines.push({ key: item.key, label: item.label, header: true, value: null });
      continue;
    }
    const row = rowForItem(item, layout);
    const raw = row ? getCell(sheet, col, row) : null;
    const value =
      raw != null && typeof raw === 'number' && !Number.isNaN(raw) ? raw : null;
    lines.push({
      key: item.key,
      label: item.label,
      value,
      pct: !!item.pct,
      sub: !!item.sub,
    });
  }
  return lines;
}

function projectionRow(args: {
  period: string;
  year: number;
  month: number;
  dataType: ProjectionDataType;
  scenario: ProjectionScenario;
  sheet: WorkSheet;
  col: number;
  sheetName: string;
  cfg: SheetConfig;
}): FinancialProjectionRow {
  const { period, year, month, dataType, scenario, sheet, col, sheetName, cfg } = args;
  const revenueRow = pickRow(cfg.revenue, dataType);
  const guestsRow = pickRow(cfg.guests, dataType);
  const netIncomeRow = pickRow(cfg.netIncome, dataType);

  return {
    period,
    year,
    month,
    dataType,
    scenario,
    revenue: Math.round(Number(getCell(sheet, col, revenueRow) ?? 0)),
    ebitda: Math.round(Number(getCell(sheet, col, cfg.ebitda) ?? 0)),
    netIncome: Math.round(Number(getCell(sheet, col, netIncomeRow) ?? 0)),
    guests: Math.round(Number(getCell(sheet, col, guestsRow) ?? 0)),
    staffCost: Math.round(getStaffCost(sheet, col, sheetName)),
    pnlLines: extractPnlLines(sheet, col, sheetName),
  };
}

export function parseFinancialProjectionsFromExcel(excelPath: string): FinancialProjectionRow[] {
  const wb = XLSX.readFile(excelPath);
  const projections: FinancialProjectionRow[] = [];

  const s2026 = wb.Sheets['Rosalita'];
  const cfg26 = SHEET_CONFIG['Rosalita'];
  if (!s2026 || !cfg26) {
    throw new Error('Rosalita sheet missing from workbook');
  }

  for (let col = 4; col <= 8; col++) {
    const month = col - 3;
    projections.push(
      projectionRow({
        period: `2026-${String(month).padStart(2, '0')}`,
        year: 2026,
        month,
        dataType: 'actual',
        scenario: 'actual',
        sheet: s2026,
        col,
        sheetName: 'Rosalita',
        cfg: cfg26,
      }),
    );
  }

  for (let col = 9; col <= 15; col++) {
    const month = col - 3;
    projections.push(
      projectionRow({
        period: `2026-${String(month).padStart(2, '0')}`,
        year: 2026,
        month,
        dataType: 'forecast',
        scenario: 'conservative',
        sheet: s2026,
        col,
        sheetName: 'Rosalita',
        cfg: cfg26,
      }),
    );
  }

  const s2027 = wb.Sheets['2027'];
  const cfg27 = SHEET_CONFIG['2027'];
  if (s2027 && cfg27) {
    for (let col = 4; col <= 15; col++) {
      const month = col - 3;
      projections.push(
        projectionRow({
          period: `2027-${String(month).padStart(2, '0')}`,
          year: 2027,
          month,
          dataType: 'forecast',
          scenario: 'conservative',
          sheet: s2027,
          col,
          sheetName: '2027',
          cfg: cfg27,
        }),
      );
    }
  }

  const s2029 = wb.Sheets['2029'];
  const cfg29 = SHEET_CONFIG['2029'];
  if (s2029 && cfg29) {
    for (let col = 4; col <= 15; col++) {
      const month = col - 3;
      projections.push(
        projectionRow({
          period: `2029-${String(month).padStart(2, '0')}`,
          year: 2029,
          month,
          dataType: 'forecast',
          scenario: 'realistic',
          sheet: s2029,
          col,
          sheetName: '2029',
          cfg: cfg29,
        }),
      );
    }
  }

  const s2030 = wb.Sheets['2030'];
  const cfg30 = SHEET_CONFIG['2030'];
  if (s2030 && cfg30) {
    for (let col = 4; col <= 15; col++) {
      const month = col - 3;
      projections.push(
        projectionRow({
          period: `2030-${String(month).padStart(2, '0')}`,
          year: 2030,
          month,
          dataType: 'forecast',
          scenario: 'aspirational',
          sheet: s2030,
          col,
          sheetName: '2030',
          cfg: cfg30,
        }),
      );
    }
  }

  return projections;
}
