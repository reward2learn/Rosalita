/**
 * Monthly actuals: manual cost inputs, Z-derived revenue, computed P&L lines.
 */
import { query } from './db.js';
import { PNL_LINE_ITEMS } from './pnl-rows.mjs';

export function num(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function isExcelLedgerMonth(period) {
  const [y, m] = String(period).split('-').map(Number);
  return y === 2026 && m <= 5;
}

function sumKeys(vals, keys) {
  let sum = 0;
  let any = false;
  for (const k of keys) {
    const n = num(vals[k]);
    if (n != null) {
      sum += n;
      any = true;
    }
  }
  return any ? sum : 0;
}

function daysInMonth(period) {
  const [y, m] = String(period).split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export const MANUAL_INPUT_SECTIONS = [
  {
    id: 'direct',
    title: 'Direct Costs (Kitchen / Bar / GM)',
    fields: [
      { key: 'purchases_food', label: 'Purchases Food', type: 'amount' },
      { key: 'purchases_beverage', label: 'Purchases Beverage & Other', type: 'amount' },
      { key: 'costs_entertainment', label: 'Costs of Entertainment', type: 'amount' },
      { key: 'other_direct', label: 'Other Direct Expenses', type: 'amount' },
    ],
  },
  {
    id: 'staff',
    title: 'Salary & Wages',
    fields: [
      { key: 'staff_mgmt_count', label: 'Management — headcount', type: 'int' },
      { key: 'staff_mgmt_cost', label: 'Management — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_dj_count', label: 'Music/DJ — headcount', type: 'int' },
      { key: 'staff_dj_cost', label: 'Music/DJ — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_reception_count', label: 'Reception/Cashier/Supervisor — headcount', type: 'int' },
      { key: 'staff_reception_cost', label: 'Reception/Cashier/Supervisor — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_waiter_count', label: 'Waiter/Waitress — headcount', type: 'int' },
      { key: 'staff_waiter_cost', label: 'Waiter/Waitress — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_bar_count', label: 'Bar Staff — headcount', type: 'int' },
      { key: 'staff_bar_cost', label: 'Bar Staff — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_kitchen_count', label: 'Kitchen — headcount', type: 'int' },
      { key: 'staff_kitchen_cost', label: 'Kitchen — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_store_count', label: 'Store/Cleaning & GRO — headcount', type: 'int' },
      { key: 'staff_store_cost', label: 'Store/Cleaning & GRO — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_travel', label: 'Staff Travel/Meal/PBJS etc', type: 'amount' },
    ],
  },
  {
    id: 'marketing',
    title: 'Sales & Marketing',
    fields: [
      { key: 'advertising', label: 'Advertising & Promotion', type: 'amount' },
      { key: 'marketing_material', label: 'Marketing Material/Printing etc', type: 'amount' },
    ],
  },
  {
    id: 'property',
    title: 'Property Rents, Repairs & Maintenance',
    fields: [
      { key: 'rents_leases', label: 'Rents & Leases', type: 'amount' },
      { key: 'body_corporate', label: 'Body Corporate', type: 'amount' },
      { key: 'repairs', label: 'Repairs & Maintenance/Replacements', type: 'amount' },
      { key: 'electric_gas', label: 'Electric & Gas', type: 'amount' },
    ],
  },
  {
    id: 'overhead',
    title: 'Overhead & General',
    fields: [
      { key: 'admin_fees', label: 'Admin/Management Fees', type: 'amount' },
      { key: 'bank_fees', label: 'Bank & Card Fees/Interest', type: 'amount' },
      { key: 'communication', label: 'Communication Costs', type: 'amount' },
      { key: 'sundry', label: 'Sundry Overhead & Costs', type: 'amount' },
      { key: 'starpoints_addback', label: 'Add Back StarPOINTS Benefit', type: 'amount' },
    ],
  },
];

export const COMPUTED_PREVIEW_KEYS = [
  { key: 'total_direct_costs', label: 'Total Direct Costs' },
  { key: 'gross_profit', label: 'Gross Profit' },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', pct: true },
  { key: 'total_staff_cost', label: 'Total Staff Cost' },
  { key: 'total_overhead', label: 'Total Overhead Expenses' },
  { key: 'total_expenses', label: 'Total Expenses' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'ebitda_margin', label: 'EBITDA Margin', pct: true },
  { key: 'net_income_pre_tax_accum', label: 'Accumulated Net Income pre Tax/Service' },
  { key: 'total_income_accum', label: 'Total Income IDR — Accumulated' },
];

const STAFF_COUNT_KEYS = [
  'staff_mgmt_count', 'staff_dj_count', 'staff_reception_count', 'staff_waiter_count',
  'staff_bar_count', 'staff_kitchen_count', 'staff_store_count',
];

const STAFF_COST_KEYS = [
  'staff_mgmt_cost', 'staff_dj_cost', 'staff_reception_cost', 'staff_waiter_cost',
  'staff_bar_cost', 'staff_kitchen_cost', 'staff_store_cost', 'staff_travel',
];

const DIRECT_KEYS = ['purchases_food', 'purchases_beverage', 'costs_entertainment', 'other_direct'];
const MARKETING_KEYS = ['advertising', 'marketing_material'];
const PROPERTY_KEYS = ['rents_leases', 'body_corporate', 'repairs', 'electric_gas'];
const GENERAL_OVERHEAD_KEYS = ['admin_fees', 'bank_fees', 'communication', 'sundry'];

export function manualFieldKeys() {
  const keys = [];
  MANUAL_INPUT_SECTIONS.forEach((s) => s.fields.forEach((f) => keys.push(f.key)));
  return keys;
}

export function sanitizeManualInputs(raw) {
  const out = {};
  const allowed = new Set(manualFieldKeys());
  for (const [k, v] of Object.entries(raw || {})) {
    if (!allowed.has(k)) continue;
    if (v == null || v === '') continue;
    const n = num(v);
    if (n == null) continue;
    out[k] = k.endsWith('_count') ? Math.round(n) : n;
  }
  return out;
}

/** Apply Z-report monthly aggregate into P&L value map */
export function applyZAggregateToValues(agg, v = {}) {
  if (!agg) return v;

  const guests = num(agg.guests) || 0;
  const days = num(agg.days_count) || 0;
  const revenue = num(agg.revenue) || 0;
  const taxService = (num(agg.tax_10) || 0) + (num(agg.service_7) || 0);

  v.target_revenue_food = num(agg.food_revenue);
  v.target_revenue_beverage = num(agg.beverage_revenue);
  v.gofood_revenue = num(agg.gofood_revenue);
  v.starcard_provision = num(agg.discounts);
  v.net_income_pre_tax = revenue || null;
  v.total_income_per_day = days ? revenue / days : null;
  v.total_guests_month = guests || null;
  v.target_guests_month = guests || null;
  v.target_guests_day = days && guests ? Math.round(guests / days) : null;
  v.spend_per_guest = guests ? revenue / guests : null;
  v.target_spend_net = v.spend_per_guest;
  v.target_spend_gross = guests ? (revenue + taxService) / guests : null;
  v.taxes_service = taxService || null;
  v.total_income_idr = revenue || null;

  return v;
}

/**
 * Merge Z-derived values, manual inputs, and computed totals/margins/YTD.
 */
export function buildComputedPnl(period, zAgg, manualInputs, ytdBefore) {
  const v = applyZAggregateToValues(zAgg, {});

  for (const [k, val] of Object.entries(manualInputs || {})) {
    v[k] = num(val);
  }

  const directTotal = sumKeys(v, DIRECT_KEYS);
  const hasDirectInput = DIRECT_KEYS.some((k) => num(v[k]) != null);
  if (hasDirectInput || v.total_income_idr != null) {
    v.total_direct_costs = directTotal;
  }

  const revenue = num(v.total_income_idr);
  if (revenue != null && v.total_direct_costs != null) {
    v.gross_profit = revenue - v.total_direct_costs;
    v.gross_profit_margin = revenue ? (v.gross_profit / revenue) * 100 : null;
  }

  const staffFte = sumKeys(v, STAFF_COUNT_KEYS);
  const hasStaffCount = STAFF_COUNT_KEYS.some((k) => num(v[k]) != null);
  if (hasStaffCount) v.total_staff_fte = staffFte;

  const staffCost = sumKeys(v, STAFF_COST_KEYS);
  const hasStaffCost = STAFF_COST_KEYS.some((k) => num(v[k]) != null);
  if (hasStaffCost) v.total_staff_cost = staffCost;

  const marketingTotal = sumKeys(v, MARKETING_KEYS);
  const propertyTotal = sumKeys(v, PROPERTY_KEYS);
  const generalTotal = sumKeys(v, GENERAL_OVERHEAD_KEYS);
  const overheadParts = [staffCost, marketingTotal, propertyTotal, generalTotal];
  const hasOverheadInput = overheadParts.some((n) => n > 0)
    || MARKETING_KEYS.concat(PROPERTY_KEYS, GENERAL_OVERHEAD_KEYS, STAFF_COST_KEYS)
      .some((k) => num(v[k]) != null);

  if (hasOverheadInput) {
    v.total_overhead = staffCost + marketingTotal + propertyTotal + generalTotal;
  }

  if (v.total_direct_costs != null && v.total_overhead != null) {
    v.total_expenses = v.total_direct_costs + v.total_overhead;
  }

  if (v.gross_profit != null && v.total_overhead != null) {
    const addback = num(v.starpoints_addback) || 0;
    v.ebitda = v.gross_profit - v.total_overhead + addback;
    if (revenue) v.ebitda_margin = (v.ebitda / revenue) * 100;
  }

  v.variable_costs = v.total_direct_costs ?? null;
  v.fixed_costs = v.total_overhead ?? null;
  if (v.gross_profit_margin != null && v.gross_profit_margin > 0 && v.fixed_costs != null) {
    v.gross_income_req_month = v.fixed_costs / (v.gross_profit_margin / 100);
    const dim = period ? daysInMonth(period) : 30;
    v.gross_revenue_req_day = v.gross_income_req_month / dim;
  }
  if (revenue != null) v.breakeven_actual = revenue;

  const priorNet = num(ytdBefore?.net_income_pre_tax) || 0;
  const priorIncome = num(ytdBefore?.total_income_idr) || 0;
  const monthNet = num(v.net_income_pre_tax) || 0;
  const monthIncome = num(v.total_income_idr) || 0;
  if (monthNet || priorNet) v.net_income_pre_tax_accum = priorNet + monthNet;
  if (monthIncome || priorIncome) v.total_income_accum = priorIncome + monthIncome;

  return v;
}

export function buildPnlLinesFromValues(values) {
  return PNL_LINE_ITEMS.map((item) => {
    if (item.header) {
      return { key: item.key, label: item.label, header: true };
    }
    return {
      key: item.key,
      label: item.label,
      value: values[item.key] ?? null,
      pct: !!item.pct,
      sub: !!item.sub,
    };
  });
}

function lineValueFromPnlLines(lines, key) {
  if (!lines) return null;
  const row = lines.find((l) => l.key === key);
  return row && row.value != null ? num(row.value) : null;
}

function parsePnlLines(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

/** Sum prior months in the same calendar year for YTD accumulation */
export async function getYtdTotalsBefore(period) {
  const [year] = String(period).split('-');
  const result = await query(
    `SELECT period, pnl_lines
     FROM financial_projections
     WHERE period LIKE $1 AND period < $2
       AND data_type = 'actual' AND scenario = 'actual'
     ORDER BY period`,
    [`${year}-%`, period],
  );

  let net = 0;
  let income = 0;
  for (const row of result.rows) {
    const lines = parsePnlLines(row.pnl_lines);
    net += lineValueFromPnlLines(lines, 'net_income_pre_tax') || 0;
    income += lineValueFromPnlLines(lines, 'total_income_idr') || 0;
  }
  return { net_income_pre_tax: net, total_income_idr: income };
}

export async function getManualInputs(period) {
  const result = await query(
    `SELECT inputs FROM monthly_actual_inputs WHERE period = $1 LIMIT 1`,
    [period],
  );
  const raw = result.rows[0]?.inputs;
  if (!raw) return {};
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

export async function saveManualInputs(period, inputs) {
  const clean = sanitizeManualInputs(inputs);
  await query(
    `INSERT INTO monthly_actual_inputs (period, inputs, updated_at)
     VALUES ($1, $2::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (period)
     DO UPDATE SET inputs = EXCLUDED.inputs, updated_at = CURRENT_TIMESTAMP`,
    [period, JSON.stringify(clean)],
  );
  return clean;
}

export function computedPreview(values) {
  const out = {};
  COMPUTED_PREVIEW_KEYS.forEach((item) => {
    out[item.key] = values[item.key] ?? null;
  });
  return out;
}
