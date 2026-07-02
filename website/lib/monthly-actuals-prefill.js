/**
 * Suggested monthly cost inputs from prior month + Excel P&L model ratios.
 * Matches Rosallita Cashflow workbook (column C factors on net income pre-tax).
 */
import {
  num,
  isExcelLedgerMonth,
  getManualInputs,
  manualFieldKeys,
  sanitizeManualInputs,
} from './pnl-actuals.js';
import { query } from './db.js';

/** Excel column C — % of net income pre-tax (row 16) */
export const NET_INCOME_RATIOS = {
  purchases_food: 0.6 * 0.30,
  purchases_beverage: 0.4 * 0.27,
  costs_entertainment: 0.02,
  other_direct: 0.022,
  advertising: 0.025,
  marketing_material: 0.005,
  repairs: 0.02,
  electric_gas: 0.06,
  bank_fees: 0.0175,
  communication: 0.005,
  sundry: 0.02,
};

/** Copy prior month as-is (fixed / structural) */
const COPY_PRIOR_KEYS = [
  'staff_mgmt_count', 'staff_dj_count', 'staff_reception_count', 'staff_waiter_count',
  'staff_bar_count', 'staff_kitchen_count', 'staff_store_count',
  'admin_fees', 'body_corporate', 'rents_leases', 'starpoints_addback',
];

/** Monthly wage rate (IDR) × 1.1 factor per Excel row 45–57 */
const STAFF_WAGE_CONFIG = [
  { count: 'staff_mgmt_count', cost: 'staff_mgmt_cost', rate: 15000000 },
  { count: 'staff_dj_count', cost: 'staff_dj_cost', rate: 5500000 },
  { count: 'staff_reception_count', cost: 'staff_reception_cost', rate: 5500000 },
  { count: 'staff_waiter_count', cost: 'staff_waiter_cost', rate: 4000000 },
  { count: 'staff_bar_count', cost: 'staff_bar_cost', rate: 4500000 },
  { count: 'staff_kitchen_count', cost: 'staff_kitchen_cost', rate: 5000000 },
  { count: 'staff_store_count', cost: 'staff_store_cost', rate: 3500000 },
];

const STAFF_WAGE_MULTIPLIER = 1.1;
const STAFF_TRAVEL_RATIO = 0.1;

export function priorPeriod(period) {
  const [y, m] = String(period).split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function lineValueFromPnlLines(lines, key) {
  if (!lines) return null;
  const row = lines.find((l) => l.key === key);
  return row && row.value != null ? num(row.value) : null;
}

async function getPnlLinesForPeriod(period) {
  const result = await query(
    `SELECT pnl_lines FROM financial_projections
     WHERE period = $1 AND data_type = 'actual' AND scenario = 'actual'
     LIMIT 1`,
    [period],
  );
  return result.rows[0]?.pnl_lines || null;
}

function inputsFromPnlLines(lines) {
  const out = {};
  if (!lines) return out;
  for (const key of manualFieldKeys()) {
    const v = lineValueFromPnlLines(lines, key);
    if (v != null) out[key] = key.endsWith('_count') ? Math.round(v) : v;
  }
  return out;
}

export async function getMonthBaseline(period) {
  const saved = await getManualInputs(period);
  if (saved && Object.keys(saved).length > 0) {
    return { period, inputs: saved, source: 'monthly_actual_inputs' };
  }

  const lines = await getPnlLinesForPeriod(period);
  const fromPnl = inputsFromPnlLines(lines);
  if (Object.keys(fromPnl).length > 0) {
    const label = isExcelLedgerMonth(period) ? 'excel' : 'financial_projections';
    return { period, inputs: fromPnl, source: label };
  }

  return { period, inputs: {}, source: 'none' };
}

/** Prior month inputs: saved form → Excel P&L lines */
export async function getPriorMonthBaseline(period) {
  const prior = priorPeriod(period);
  const baseline = await getMonthBaseline(prior);
  return { prior: baseline.period, inputs: baseline.inputs, source: baseline.source };
}

function applyRevenueRatios(out, netIncome) {
  if (netIncome == null || netIncome <= 0) return;
  for (const [key, ratio] of Object.entries(NET_INCOME_RATIOS)) {
    out[key] = Math.round(netIncome * ratio);
  }
}

function scaleRevenueLinkedFromPrior(out, priorInputs, currentNet, priorNet) {
  if (!priorNet || priorNet <= 0 || !currentNet || currentNet <= 0) {
    applyRevenueRatios(out, currentNet || priorNet);
    return;
  }
  const factor = currentNet / priorNet;
  for (const key of Object.keys(NET_INCOME_RATIOS)) {
    const base = num(priorInputs[key]);
    if (base != null) {
      out[key] = Math.round(base * factor);
    } else {
      out[key] = Math.round(currentNet * NET_INCOME_RATIOS[key]);
    }
  }
}

function applyStaffCosts(out) {
  let wageSum = 0;
  for (const cfg of STAFF_WAGE_CONFIG) {
    const count = Math.round(num(out[cfg.count]) || 0);
    out[cfg.count] = count;
    if (count > 0) {
      const cost = Math.round(count * cfg.rate * STAFF_WAGE_MULTIPLIER);
      out[cfg.cost] = cost;
      wageSum += cost;
    } else {
      out[cfg.cost] = 0;
    }
  }
  out.staff_travel = wageSum > 0 ? Math.round(wageSum * STAFF_TRAVEL_RATIO) : 0;
}

/**
 * Build suggested inputs for a month.
 * @param {string} period - YYYY-MM
 * @param {object|null} zAgg - Z-report aggregate for current month
 */
export async function buildPrefillInputs(period, zAgg, options = {}) {
  const fromPeriod = options.fromPeriod || priorPeriod(period);
  const { inputs: priorInputs, source } = await getMonthBaseline(fromPeriod);
  const out = {};

  for (const key of COPY_PRIOR_KEYS) {
    if (priorInputs[key] != null) {
      out[key] = key.endsWith('_count') ? Math.round(priorInputs[key]) : priorInputs[key];
    }
  }

  const currentNet = zAgg?.revenue != null ? num(zAgg.revenue) : null;
  let priorNet = null;
  const priorLines = await getPnlLinesForPeriod(fromPeriod);
  if (priorLines) {
    priorNet = lineValueFromPnlLines(priorLines, 'net_income_pre_tax');
  }

  if (currentNet != null) {
    scaleRevenueLinkedFromPrior(out, priorInputs, currentNet, priorNet);
  } else if (priorNet != null) {
    applyRevenueRatios(out, priorNet);
  } else {
    for (const key of Object.keys(NET_INCOME_RATIOS)) {
      if (priorInputs[key] != null) out[key] = priorInputs[key];
    }
  }

  applyStaffCosts(out);

  const clean = sanitizeManualInputs(out);
  const sourceLabel = source === 'excel'
    ? `${fromPeriod} (Excel)`
    : source === 'monthly_actual_inputs'
      ? `${fromPeriod} (saved)`
      : source === 'financial_projections'
        ? `${fromPeriod} (P&L)`
        : fromPeriod;

  return {
    inputs: clean,
    prefill_meta: {
      prior_period: fromPeriod,
      prior_source: source,
      prior_label: sourceLabel,
      net_income_used: currentNet ?? priorNet,
      net_income_from: currentNet != null ? 'z_reports' : (priorNet != null ? 'prior_month' : null),
      rents_note: 'Rent copied from prior month — verify if lease changed.',
    },
  };
}
