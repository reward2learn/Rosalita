/**
 * Load financial projections from Excel P&L into Neon DB.
 *
 * Usage: node scripts/load_financial_data.mjs
 *
 * Maps each year's sheet to a scenario:
 *   - 2026 actuals          → scenario='actual'
 *   - 2026 forecast (Jun-Dec) → scenario='conservative'
 *   - 2027 forecast          → scenario='conservative'
 *   - 2029 forecast          → scenario='realistic'
 *   - 2030 forecast          → scenario='aspirational'
 *
 * Run this *after* the DB migration (lib/db.js auto-runs it).
 */
import XLSX from 'xlsx';
import { neon } from '@neondatabase/serverless';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PNL_LINE_ITEMS, layoutForSheet, rowForItem } from '../lib/pnl-rows.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

const EXCEL_PATH = resolve(__dirname, '../../../Rosalita/Rosallita Cashflow May 24th 2026.xlsx');

function getCell(sheet, col, row) {
  const addr = XLSX.utils.encode_cell({ c: col - 1, r: row - 1 });
  return sheet[addr] ? sheet[addr].v : null;
}

// Staff cost = sum of individual wage rows + travel
// 2026 uses different rows (more categories); 2027+ use the same layout
function getStaffCost(sheet, col, sheetName) {
  const costRows = sheetName === 'Rosalita'
    ? [45, 47, 49, 51, 53, 55, 57, 58]
    : [35, 37, 39, 41, 43, 44];
  let total = 0;
  for (const r of costRows) {
    const v = getCell(sheet, col, r);
    if (v != null && !isNaN(v)) total += v;
  }
  return total;
}

function extractPnlLines(sheet, col, sheetName) {
  const layout = layoutForSheet(sheetName);
  const lines = [];
  for (const item of PNL_LINE_ITEMS) {
    if (item.header) {
      lines.push({ key: item.key, label: item.label, header: true });
      continue;
    }
    const row = rowForItem(item, layout);
    const raw = row ? getCell(sheet, col, row) : null;
    const value = raw != null && typeof raw === 'number' && !isNaN(raw) ? raw : null;
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

function projectionRow({ period, year, month, data_type, scenario, sheet, col, sheetName, cfg }) {
  const guestsRow = typeof cfg.guests === 'object' ? cfg.guests[data_type === 'actual' ? 'actual' : 'forecast'] : cfg.guests;
  const revenueRow = typeof cfg.revenue === 'object' ? cfg.revenue[data_type === 'actual' ? 'actual' : 'forecast'] : cfg.revenue;
  const netIncomeRow = typeof cfg.netIncome === 'object' ? cfg.netIncome[data_type === 'actual' ? 'actual' : 'forecast'] : cfg.netIncome;

  return {
    period, year, month, data_type, scenario,
    revenue: getCell(sheet, col, revenueRow) || 0,
    ebitda: getCell(sheet, col, cfg.ebitda) || 0,
    net_income: getCell(sheet, col, netIncomeRow) || 0,
    guests: Math.round(getCell(sheet, col, guestsRow) || 0),
    staff_cost: getStaffCost(sheet, col, sheetName) || 0,
    pnl_lines: extractPnlLines(sheet, col, sheetName),
  };
}

// ── Row mappings per sheet ──────────────────────────────────────────
// Each sheet has: EBITDA, Total Income IDR (revenue), Guests, Net Income
// at consistent positions across 2027+ sheets.
const SHEET_CONFIG = {
  'Rosalita': {
    ebitda: 84,
    revenue: { actual: 29, forecast: 27 },
    guests: { actual: 23, forecast: 22 },
    netIncome: { actual: 18, forecast: 16 },
    staffCost: { actual: null, forecast: null },  // computed inline
  },
  '2027': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
    staffCost: null,  // computed inline
  },
  '2029': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
    staffCost: null,
  },
  '2030': {
    ebitda: 66,
    revenue: 21,
    guests: 19,
    netIncome: 17,
    staffCost: null,
  },
};

async function main() {
  const connStr = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connStr) {
    console.error('POSTGRES_URL not set. Use .env.local or export it.');
    process.exit(1);
  }
  const sql = neon(connStr);
  console.log('[loader] Connected to DB');

  // ── Migration: add scenario column and update constraint ──
  console.log('[loader] Running DB migration...');
  await sql`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS scenario TEXT NOT NULL DEFAULT 'conservative';`;
  await sql`UPDATE financial_projections SET scenario = 'actual' WHERE data_type = 'actual' AND scenario = 'conservative';`;
  await sql`UPDATE financial_projections SET scenario = 'conservative' WHERE data_type = 'forecast' AND scenario = 'actual';`;
  await sql`ALTER TABLE financial_projections DROP CONSTRAINT IF EXISTS financial_projections_period_data_type_key;`;
  try {
    await sql`ALTER TABLE financial_projections ADD CONSTRAINT financial_projections_period_data_type_scenario_key UNIQUE (period, data_type, scenario);`;
  } catch (_) { /* may already exist */ }
  await sql`ALTER TABLE financial_projections ADD COLUMN IF NOT EXISTS pnl_lines JSONB`;
  console.log('[loader] Migration complete.');

  const wb = XLSX.readFile(EXCEL_PATH);
  console.log('[loader] Loaded workbook');

  const projections = [];

  // ── 2026 Actual (Jan-May) ─────────────────────────────────────
  const s2026 = wb.Sheets['Rosalita'];
  const cfg26 = SHEET_CONFIG['Rosalita'];
  for (let col = 4; col <= 8; col++) {
    const month = col - 3;
    const period = `2026-${String(month).padStart(2, '0')}`;
    projections.push(projectionRow({
      period, year: 2026, month, data_type: 'actual', scenario: 'actual',
      sheet: s2026, col, sheetName: 'Rosalita', cfg: cfg26,
    }));
  }

  // ── 2026 Forecast (Jun-Dec) → scenario='conservative' ─────────
  for (let col = 9; col <= 15; col++) {
    const month = col - 3;
    const period = `2026-${String(month).padStart(2, '0')}`;
    projections.push(projectionRow({
      period, year: 2026, month, data_type: 'forecast', scenario: 'conservative',
      sheet: s2026, col, sheetName: 'Rosalita', cfg: cfg26,
    }));
  }

  // ── 2027 Forecast → scenario='conservative' ──────────────────
  const s2027 = wb.Sheets['2027'];
  const cfg27 = SHEET_CONFIG['2027'];
  for (let col = 4; col <= 15; col++) {
    const month = col - 3;
    const period = `2027-${String(month).padStart(2, '0')}`;
    projections.push(projectionRow({
      period, year: 2027, month, data_type: 'forecast', scenario: 'conservative',
      sheet: s2027, col, sheetName: '2027', cfg: cfg27,
    }));
  }

  // ── 2029 Forecast → scenario='realistic' ─────────────────────
  const s2029 = wb.Sheets['2029'];
  const cfg29 = SHEET_CONFIG['2029'];
  for (let col = 4; col <= 15; col++) {
    const month = col - 3;
    const period = `2029-${String(month).padStart(2, '0')}`;
    projections.push(projectionRow({
      period, year: 2029, month, data_type: 'forecast', scenario: 'realistic',
      sheet: s2029, col, sheetName: '2029', cfg: cfg29,
    }));
  }

  // ── 2030 Forecast → scenario='aspirational' ──────────────────
  const s2030 = wb.Sheets['2030'];
  const cfg30 = SHEET_CONFIG['2030'];
  for (let col = 4; col <= 15; col++) {
    const month = col - 3;
    const period = `2030-${String(month).padStart(2, '0')}`;
    projections.push(projectionRow({
      period, year: 2030, month, data_type: 'forecast', scenario: 'aspirational',
      sheet: s2030, col, sheetName: '2030', cfg: cfg30,
    }));
  }

  // ── Upsert into DB ────────────────────────────────────────────
  console.log(`[loader] Inserting ${projections.length} rows...`);
  let count = 0;
  for (const row of projections) {
    const { period, year, month, data_type, scenario, revenue, ebitda, net_income, guests, staff_cost, pnl_lines } = row;
    const pnlJson = JSON.stringify(pnl_lines);
    await sql`
      INSERT INTO financial_projections (period, year, month, data_type, scenario, revenue, ebitda, net_income, guests, staff_cost, pnl_lines)
      VALUES (${period}, ${year}, ${month}, ${data_type}, ${scenario}, ${revenue}, ${ebitda}, ${net_income}, ${guests}, ${staff_cost || 0}, ${pnlJson}::jsonb)
      ON CONFLICT (period, data_type, scenario)
      DO UPDATE SET
        revenue = EXCLUDED.revenue,
        ebitda = EXCLUDED.ebitda,
        net_income = EXCLUDED.net_income,
        guests = EXCLUDED.guests,
        staff_cost = EXCLUDED.staff_cost,
        pnl_lines = EXCLUDED.pnl_lines;
    `;
    count++;
    if (count % 20 === 0) process.stdout.write('.');
  }
  console.log(`\n[loader] Done — ${count} rows upserted successfully.`);
}

main().catch(err => {
  console.error('[loader] Fatal error:', err);
  process.exit(1);
});
