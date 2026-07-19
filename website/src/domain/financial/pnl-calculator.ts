export interface PnlLineItemDef {
  key: string;
  label: string;
  header?: boolean;
  pct?: boolean;
  sub?: boolean;
}

export const PNL_LINE_ITEMS: PnlLineItemDef[] = [
  { key: 'header_title', label: 'Profit & Loss Projections', header: true },
  { key: 'venue', label: 'Red Ruby Bali', header: true },
  { key: 'gross_income_idr', label: 'Gross Income IDR', header: true },
  { key: 'club_guests_night', label: 'Guests - Club per night' },
  { key: 'club_guests_month', label: 'Guests - Club per month' },
  { key: 'club_target_spend', label: 'Target Spend - Club' },
  { key: 'club_target_revenue', label: 'Target Revenue - Club' },
  { key: 'terrace_guests_night', label: 'Guests - Terrace per night' },
  { key: 'terrace_guests_month', label: 'Guests - Terrace per month' },
  { key: 'terrace_target_spend', label: 'Target Spend - Terrace' },
  { key: 'terrace_target_revenue', label: 'Target Revenue - Terrace' },
  { key: 'discounts_foc', label: 'Discounts / FOC / Cash Back' },
  { key: 'net_income_pre_tax', label: 'Net Income pre Tax/Service' },
  { key: 'net_income_pre_tax_accum', label: 'Accumulated Net Income pre Tax/Service' },
  { key: 'avg_net_income_per_day', label: 'Average Net Income per Day' },
  { key: 'total_guests_month', label: 'Total Guests per month' },
  { key: 'spend_per_guest', label: 'Spend per Guest' },
  { key: 'taxes_service', label: 'Taxes and Service Charge Provision' },
  { key: 'total_income_idr', label: 'Total Income IDR' },
  { key: 'total_income_accum', label: 'Total Income IDR - Accumulated' },
  { key: 'less_direct_costs', label: 'Less Direct Costs', header: true },
  { key: 'purchases_beverage', label: 'Purchases Beverage' },
  { key: 'purchases_food', label: 'Purchases Food & Other' },
  { key: 'promoter_costs', label: 'Promoter / Influencer Costs' },
  { key: 'costs_entertainment', label: 'Net Ticket Costs / Entertainment' },
  { key: 'other_direct', label: 'Other Direct Expenses' },
  { key: 'total_direct_costs', label: 'Total Direct Costs' },
  { key: 'gross_profit', label: 'Gross Profit' },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', pct: true },
  { key: 'overhead_expenses', label: 'Overhead Expenses', header: true },
  { key: 'salary_wages_pkg', label: 'Salary & Wages Package', header: true },
  { key: 'staff_mgmt_count', label: 'Management - headcount' },
  { key: 'staff_mgmt_cost', label: 'Management - cost', sub: true },
  { key: 'staff_supervisor_count', label: 'Supervisor - headcount' },
  { key: 'staff_supervisor_cost', label: 'Supervisor - cost', sub: true },
  { key: 'staff_admin_count', label: 'Admin/Cashier/Merc - headcount' },
  { key: 'staff_admin_cost', label: 'Admin/Cashier/Merc - cost', sub: true },
  { key: 'staff_bar_count', label: 'Bar Staff - headcount' },
  { key: 'staff_bar_cost', label: 'Bar Staff - cost', sub: true },
  { key: 'staff_host_count', label: 'Host/Floor/Waiter - headcount' },
  { key: 'staff_host_cost', label: 'Host/Floor/Waiter - cost', sub: true },
  { key: 'staff_marketing_count', label: 'Marketing & GRO - headcount' },
  { key: 'staff_marketing_cost', label: 'Marketing & GRO - cost', sub: true },
  { key: 'staff_kitchen_count', label: 'Kitchen - headcount' },
  { key: 'staff_kitchen_cost', label: 'Kitchen - cost', sub: true },
  { key: 'staff_security_count', label: 'Security & Valet - headcount' },
  { key: 'staff_security_cost', label: 'Security & Valet - cost', sub: true },
  { key: 'staff_store_count', label: 'Store/Cleaning - headcount' },
  { key: 'staff_store_cost', label: 'Store/Cleaning - cost', sub: true },
  { key: 'staff_daily_count', label: 'Daily/Contract Worker - headcount' },
  { key: 'staff_daily_cost', label: 'Daily/Contract Worker - cost', sub: true },
  { key: 'staff_travel', label: 'Staff Travel/Meal/Medical etc' },
  { key: 'total_staff_fte', label: 'Total Staff - Full Time' },
  { key: 'total_staff_cost', label: 'Total Staff - Full Time', sub: true },
  { key: 'sales_marketing', label: 'Sales & Marketing Costs', header: true },
  { key: 'advertising', label: 'Advertising & Promotion' },
  { key: 'marketing_material', label: 'Marketing Material/Printing etc' },
  { key: 'rental_equipment', label: 'Rental Equipment etc' },
  { key: 'property_header', label: 'Property Rents, Repairs & Maintenance', header: true },
  { key: 'rents_leases', label: 'Rents & Leases' },
  { key: 'repairs', label: 'Repairs & Maintenance/Replacements' },
  { key: 'electric_gas', label: 'Electric & Gas' },
  { key: 'overhead_general', label: 'Overhead & General Expenses', header: true },
  { key: 'accounting_fees', label: 'Accounting Fees' },
  { key: 'bank_fees', label: 'Bank & Card Fees/Interest' },
  { key: 'communication', label: 'Communication Costs' },
  { key: 'legal_permits', label: 'Legal/Permits/Ceremony/Banjar' },
  { key: 'sundry', label: 'Sundry Overhead & Costs' },
  { key: 'travel_accom', label: 'Travel & Accommodation Costs' },
  { key: 'total_overhead', label: 'Total Overhead Expenses' },
  { key: 'total_expenses', label: 'Total Expenses' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'ebitda_margin', label: 'EBITDA Margin', pct: true },
];

export interface ManualField {
  key: string;
  label: string;
  type: 'amount' | 'int';
  sub?: boolean;
}

export interface ManualInputSection {
  id: string;
  title: string;
  fields: ManualField[];
}

export const MANUAL_INPUT_SECTIONS: ManualInputSection[] = [
  {
    id: 'direct',
    title: 'Direct Costs',
    fields: [
      { key: 'purchases_beverage', label: 'Purchases Beverage', type: 'amount' },
      { key: 'purchases_food', label: 'Purchases Food & Other', type: 'amount' },
      { key: 'promoter_costs', label: 'Promoter / Influencer Costs', type: 'amount' },
      { key: 'costs_entertainment', label: 'Net Ticket Costs / Entertainment', type: 'amount' },
      { key: 'other_direct', label: 'Other Direct Expenses', type: 'amount' },
    ],
  },
  {
    id: 'staff',
    title: 'Salary & Wages',
    fields: [
      { key: 'staff_mgmt_count', label: 'Management — headcount', type: 'int' },
      { key: 'staff_mgmt_cost', label: 'Management — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_supervisor_count', label: 'Supervisor — headcount', type: 'int' },
      { key: 'staff_supervisor_cost', label: 'Supervisor — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_admin_count', label: 'Admin/Cashier/Merc — headcount', type: 'int' },
      { key: 'staff_admin_cost', label: 'Admin/Cashier/Merc — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_bar_count', label: 'Bar Staff — headcount', type: 'int' },
      { key: 'staff_bar_cost', label: 'Bar Staff — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_host_count', label: 'Host/Floor/Waiter — headcount', type: 'int' },
      { key: 'staff_host_cost', label: 'Host/Floor/Waiter — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_marketing_count', label: 'Marketing & GRO — headcount', type: 'int' },
      { key: 'staff_marketing_cost', label: 'Marketing & GRO — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_kitchen_count', label: 'Kitchen — headcount', type: 'int' },
      { key: 'staff_kitchen_cost', label: 'Kitchen — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_security_count', label: 'Security & Valet — headcount', type: 'int' },
      { key: 'staff_security_cost', label: 'Security & Valet — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_store_count', label: 'Store/Cleaning — headcount', type: 'int' },
      { key: 'staff_store_cost', label: 'Store/Cleaning — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_daily_count', label: 'Daily/Contract Worker — headcount', type: 'int' },
      { key: 'staff_daily_cost', label: 'Daily/Contract Worker — cost (IDR)', type: 'amount', sub: true },
      { key: 'staff_travel', label: 'Staff Travel/Meal/Medical etc', type: 'amount' },
    ],
  },
  {
    id: 'marketing',
    title: 'Sales & Marketing',
    fields: [
      { key: 'advertising', label: 'Advertising & Promotion', type: 'amount' },
      { key: 'marketing_material', label: 'Marketing Material/Printing etc', type: 'amount' },
      { key: 'rental_equipment', label: 'Rental Equipment etc', type: 'amount' },
    ],
  },
  {
    id: 'property',
    title: 'Property Rents, Repairs & Maintenance',
    fields: [
      { key: 'rents_leases', label: 'Rents & Leases', type: 'amount' },
      { key: 'repairs', label: 'Repairs & Maintenance/Replacements', type: 'amount' },
      { key: 'electric_gas', label: 'Electric & Gas', type: 'amount' },
    ],
  },
  {
    id: 'overhead',
    title: 'Overhead & General',
    fields: [
      { key: 'accounting_fees', label: 'Accounting Fees', type: 'amount' },
      { key: 'bank_fees', label: 'Bank & Card Fees/Interest', type: 'amount' },
      { key: 'communication', label: 'Communication Costs', type: 'amount' },
      { key: 'legal_permits', label: 'Legal/Permits/Ceremony/Banjar', type: 'amount' },
      { key: 'sundry', label: 'Sundry Overhead & Costs', type: 'amount' },
      { key: 'travel_accom', label: 'Travel & Accommodation Costs', type: 'amount' },
    ],
  },
];

export const COMPUTED_PREVIEW_KEYS = [
  { key: 'total_direct_costs', label: 'Total Direct Costs' },
  { key: 'gross_profit', label: 'Gross Profit' },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', pct: true },
  { key: 'total_staff_fte', label: 'Total Staff FTE' },
  { key: 'total_staff_cost', label: 'Total Staff Cost' },
  { key: 'total_overhead', label: 'Total Overhead Expenses' },
  { key: 'total_expenses', label: 'Total Expenses' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'ebitda_margin', label: 'EBITDA Margin', pct: true },
  { key: 'net_income_pre_tax_accum', label: 'Accumulated Net Income pre Tax/Service' },
  { key: 'total_income_accum', label: 'Total Income IDR — Accumulated' },
] as const;

const STAFF_COUNT_KEYS = [
  'staff_mgmt_count', 'staff_supervisor_count', 'staff_admin_count', 'staff_bar_count',
  'staff_host_count', 'staff_marketing_count', 'staff_kitchen_count',
  'staff_security_count', 'staff_store_count', 'staff_daily_count',
];

const STAFF_COST_KEYS = [
  'staff_mgmt_cost', 'staff_supervisor_cost', 'staff_admin_cost', 'staff_bar_cost',
  'staff_host_cost', 'staff_marketing_cost', 'staff_kitchen_cost',
  'staff_security_cost', 'staff_store_cost', 'staff_daily_cost', 'staff_travel',
];

const DIRECT_KEYS = ['purchases_beverage', 'purchases_food', 'promoter_costs', 'costs_entertainment', 'other_direct'];
const MARKETING_KEYS = ['advertising', 'marketing_material', 'rental_equipment'];
const PROPERTY_KEYS = ['rents_leases', 'repairs', 'electric_gas'];
const GENERAL_OVERHEAD_KEYS = ['accounting_fees', 'bank_fees', 'communication', 'legal_permits', 'sundry', 'travel_accom'];

export function isExcelLedgerMonth(period: string): boolean {
  const [y, m] = String(period).split('-').map(Number);
  return y === 2026 && m <= 5;
}

export function manualFieldKeys(): string[] {
  const keys: string[] = [];
  MANUAL_INPUT_SECTIONS.forEach((s) => s.fields.forEach((f) => keys.push(f.key)));
  return keys;
}

function sumKeys(vals: Record<string, unknown>, keys: string[]): number {
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

export function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function sanitizeManualInputs(raw: Record<string, unknown> | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  const allowed = new Set(manualFieldKeys());
  for (const [k, v] of Object.entries(raw ?? {})) {
    if (!allowed.has(k)) continue;
    if (v == null || v === '') continue;
    const n = num(v);
    if (n == null) continue;
    out[k] = k.endsWith('_count') ? Math.round(n) : n;
  }
  return out;
}

export interface ZMonthAggregate {
  period: string;
  days_count: number;
  revenue: number;
  guests: number;
  gofood_revenue: number;
  dine_in_amount: number;
  food_revenue: number;
  beverage_revenue: number;
  tax_10: number;
  service_7: number;
  discounts: number;
  voids: number;
  avg_spend: number | null;
}

export function applyZAggregateToValues(
  agg: ZMonthAggregate | null | undefined,
  v: Record<string, number | null> = {},
): Record<string, number | null> {
  if (!agg) return v;

  const guests = num(agg.guests) || 0;
  const days = num(agg.days_count) || 0;
  const revenue = num(agg.revenue) || 0;
  const taxService = (num(agg.tax_10) || 0) + (num(agg.service_7) || 0);

  v.discounts_foc = num(agg.discounts);
  v.net_income_pre_tax = revenue || null;
  v.avg_net_income_per_day = days ? revenue / days : null;
  v.total_guests_month = guests || null;
  v.club_guests_month = guests || null;
  v.club_guests_night = days && guests ? Math.round(guests / days) : null;
  v.spend_per_guest = guests ? revenue / guests : null;
  v.club_target_spend = v.spend_per_guest;
  v.terrace_target_spend = guests ? (revenue + taxService) / guests : null;
  v.taxes_service = taxService || null;
  v.total_income_idr = revenue || null;

  return v;
}

export function buildComputedPnl(
  period: string,
  zAgg: ZMonthAggregate | null | undefined,
  manualInputs: Record<string, number> | null | undefined,
  ytdBefore: { net_income_pre_tax?: number; total_income_idr?: number } | null | undefined,
): Record<string, number | null> {
  const v = applyZAggregateToValues(zAgg, {}) as Record<string, number | null>;

  for (const [k, val] of Object.entries(manualInputs ?? {})) {
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
    v.ebitda = v.gross_profit - v.total_overhead;
    if (revenue) v.ebitda_margin = (v.ebitda / revenue) * 100;
  }

  const priorNet = num(ytdBefore?.net_income_pre_tax) || 0;
  const priorIncome = num(ytdBefore?.total_income_idr) || 0;
  const monthNet = num(v.net_income_pre_tax) || 0;
  const monthIncome = num(v.total_income_idr) || 0;
  if (monthNet || priorNet) v.net_income_pre_tax_accum = priorNet + monthNet;
  if (monthIncome || priorIncome) v.total_income_accum = priorIncome + monthIncome;

  return v;
}

export interface PnlLine {
  key: string;
  label: string;
  header?: boolean;
  value?: number | null;
  pct?: boolean;
  sub?: boolean;
}

export function buildPnlLinesFromValues(values: Record<string, number | null>): PnlLine[] {
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

export function lineValueFromPnlLines(lines: PnlLine[] | null | undefined, key: string): number | null {
  if (!lines) return null;
  const row = lines.find((l) => l.key === key);
  return row && row.value != null ? num(row.value) : null;
}

export function parsePnlLines(val: unknown): PnlLine[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as PnlLine[];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val) as unknown;
      return Array.isArray(parsed) ? (parsed as PnlLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function computedPreview(values: Record<string, number | null>): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  COMPUTED_PREVIEW_KEYS.forEach((item) => {
    out[item.key] = values[item.key] ?? null;
  });
  return out;
}
