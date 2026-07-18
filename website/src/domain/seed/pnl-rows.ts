/**
 * Ordered P&L line items matching the Red Ruby Excel workbook layout.
 * Based on: Red Ruby Club & Terrace Bar Cashflow Budgets.xlsx
 */
export interface PnlLineItem {
  key: string;
  label: string;
  header?: boolean;
  row?: { redruby: number; forecast: number | null };
  pct?: boolean;
  sub?: boolean;
  altLabel?: string;
}

export const PNL_LINE_ITEMS: PnlLineItem[] = [
  { key: 'header_title', label: 'Profit & Loss Projections', header: true },
  { key: 'venue', label: 'Red Ruby Bali', header: true },
  { key: 'gross_income_idr', label: 'Gross Income IDR', header: true },

  // ── Club Revenue ──
  { key: 'club_guests_night', label: 'Guests - Club per night', row: { redruby: 7, forecast: null } },
  { key: 'club_guests_month', label: 'Guests - Club per month', row: { redruby: 8, forecast: null } },
  { key: 'club_target_spend', label: 'Target Spend - Club', row: { redruby: 9, forecast: null } },
  { key: 'club_target_revenue', label: 'Target Revenue - Club', row: { redruby: 10, forecast: null } },

  // ── Terrace Revenue ──
  { key: 'terrace_guests_night', label: 'Guests - Terrace per night', row: { redruby: 11, forecast: null } },
  { key: 'terrace_guests_month', label: 'Guests - Terrace per month', row: { redruby: 12, forecast: null } },
  { key: 'terrace_target_spend', label: 'Target Spend - Terrace', row: { redruby: 13, forecast: null } },
  { key: 'terrace_target_revenue', label: 'Target Revenue - Terrace', row: { redruby: 14, forecast: null } },

  // ── Aggregates ──
  { key: 'discounts_foc', label: 'Discounts / FOC / Cash Back', row: { redruby: 15, forecast: null } },
  { key: 'net_income_pre_tax', label: 'Net Income pre Tax/Service', row: { redruby: 16, forecast: null } },
  { key: 'net_income_pre_tax_accum', label: 'Accumulated Net Income pre Tax/Service', row: { redruby: 17, forecast: null } },
  { key: 'avg_net_income_per_day', label: 'Average Net Income per Day', row: { redruby: 20, forecast: null } },
  { key: 'total_guests_month', label: 'Total Guests per month', row: { redruby: 22, forecast: null } },
  { key: 'spend_per_guest', label: 'Spend per Guest (incl. tax & service)', row: { redruby: 24, forecast: null } },
  { key: 'taxes_service', label: 'Taxes and Service Charge Provision', row: { redruby: 26, forecast: null } },
  { key: 'total_income_idr', label: 'Total Income IDR', row: { redruby: 28, forecast: null } },

  // ── Direct Costs ──
  { key: 'less_direct_costs', label: 'Less Direct Costs', header: true },
  { key: 'purchases_beverage', label: 'Purchases Beverage', row: { redruby: 33, forecast: null } },
  { key: 'purchases_food', label: 'Purchases Food & Other', row: { redruby: 34, forecast: null } },
  { key: 'promoter_costs', label: 'Promoter / Influencer Costs', row: { redruby: 35, forecast: null } },
  { key: 'costs_entertainment', label: 'Net Ticket Costs / Entertainment', row: { redruby: 36, forecast: null } },
  { key: 'other_direct', label: 'Other Direct Expenses', row: { redruby: 37, forecast: null } },
  { key: 'total_direct_costs', label: 'Total Direct Costs', row: { redruby: 38, forecast: null } },
  { key: 'gross_profit', label: 'Gross Profit', row: { redruby: 39, forecast: null } },
  { key: 'gross_profit_margin', label: 'Gross Profit Margin', pct: true, row: { redruby: 40, forecast: null } },

  // ── Salary & Wages ──
  { key: 'salary_wages_pkg', label: 'Salary & Wages', header: true },
  { key: 'staff_mgmt_count', label: 'Management — headcount', row: { redruby: 46, forecast: null } },
  { key: 'staff_mgmt_cost', label: 'Management — cost', sub: true, row: { redruby: 47, forecast: null } },
  { key: 'staff_supervisor_count', label: 'Supervisor — headcount', row: { redruby: 48, forecast: null } },
  { key: 'staff_supervisor_cost', label: 'Supervisor — cost', sub: true, row: { redruby: 49, forecast: null } },
  { key: 'staff_admin_count', label: 'Admin/Cashier/Merc — headcount', row: { redruby: 50, forecast: null } },
  { key: 'staff_admin_cost', label: 'Admin/Cashier/Merc — cost', sub: true, row: { redruby: 51, forecast: null } },
  { key: 'staff_bar_count', label: 'Bar Staff — headcount', row: { redruby: 52, forecast: null } },
  { key: 'staff_bar_cost', label: 'Bar Staff — cost', sub: true, row: { redruby: 53, forecast: null } },
  { key: 'staff_host_count', label: 'Host/Floor/Waiter — headcount', row: { redruby: 54, forecast: null } },
  { key: 'staff_host_cost', label: 'Host/Floor/Waiter — cost', sub: true, row: { redruby: 55, forecast: null } },
  { key: 'staff_marketing_count', label: 'Marketing & GRO — headcount', row: { redruby: 56, forecast: null } },
  { key: 'staff_marketing_cost', label: 'Marketing & GRO — cost', sub: true, row: { redruby: 57, forecast: null } },
  { key: 'staff_kitchen_count', label: 'Kitchen — headcount', row: { redruby: 58, forecast: null } },
  { key: 'staff_kitchen_cost', label: 'Kitchen — cost', sub: true, row: { redruby: 59, forecast: null } },
  { key: 'staff_security_count', label: 'Security & Valet — headcount', row: { redruby: 60, forecast: null } },
  { key: 'staff_security_cost', label: 'Security & Valet — cost', sub: true, row: { redruby: 61, forecast: null } },
  { key: 'staff_store_count', label: 'Store/Cleaning — headcount', row: { redruby: 62, forecast: null } },
  { key: 'staff_store_cost', label: 'Store/Cleaning — cost', sub: true, row: { redruby: 63, forecast: null } },
  { key: 'staff_daily_count', label: 'Daily/Contract Worker — headcount', row: { redruby: 64, forecast: null } },
  { key: 'staff_daily_cost', label: 'Daily/Contract Worker — cost', sub: true, row: { redruby: 65, forecast: null } },
  { key: 'staff_travel', label: 'Staff Travel/Meal/Medical/etc', row: { redruby: 66, forecast: null } },
  { key: 'total_staff_fte', label: 'Total Staff — Full Time', row: { redruby: 67, forecast: null } },
  { key: 'total_staff_cost', label: 'Total Salary & Wage Costs', sub: true, row: { redruby: 68, forecast: null } },

  // ── Sales & Marketing ──
  { key: 'sales_marketing', label: 'Sales & Marketing Costs', header: true },
  { key: 'advertising', label: 'Advertising & Promotion', row: { redruby: 73, forecast: null } },
  { key: 'marketing_material', label: 'Marketing Material/Printing etc', row: { redruby: 74, forecast: null } },
  { key: 'rental_equipment', label: 'Rental Equipment etc', row: { redruby: 75, forecast: null } },

  // ── Property ──
  { key: 'property_header', label: 'Property Rents, Repairs & Maintenance', header: true },
  { key: 'rents_leases', label: 'Rents & Leases', row: { redruby: 78, forecast: null } },
  { key: 'repairs', label: 'Repairs & Maintenance / Replacements', row: { redruby: 79, forecast: null } },
  { key: 'electric_gas', label: 'Electric & Gas', row: { redruby: 80, forecast: null } },

  // ── Overhead & General ──
  { key: 'overhead_general', label: 'Overhead & General Expenses', header: true },
  { key: 'accounting_fees', label: 'Accounting Fees', row: { redruby: 83, forecast: null } },
  { key: 'bank_fees', label: 'Bank & Card Fees / Interest', row: { redruby: 84, forecast: null } },
  { key: 'communication', label: 'Communication Costs', row: { redruby: 85, forecast: null } },
  { key: 'legal_permits', label: 'Legal / Permits / Ceremony / Banjar', row: { redruby: 86, forecast: null } },
  { key: 'sundry', label: 'Sundry Overhead & Costs', row: { redruby: 87, forecast: null } },
  { key: 'travel_accom', label: 'Travel & Accommodation Costs', row: { redruby: 88, forecast: null } },

  // ── Totals ──
  { key: 'total_overhead', label: 'Total Overhead Expenses', row: { redruby: 89, forecast: null } },
  { key: 'total_expenses', label: 'Total Expenses', row: { redruby: 91, forecast: null } },

  // ── EBITDA ──
  { key: 'ebitda', label: 'EBITDA', row: { redruby: 94, forecast: null } },
  { key: 'ebitda_margin', label: 'EBITDA Margin', pct: true, row: { redruby: 95, forecast: null } },
];

export type SheetLayout = 'redruby' | 'forecast';

export function layoutForSheet(sheetName: string): SheetLayout {
  return sheetName === 'RedRuby' ? 'redruby' : 'forecast';
}

export function rowForItem(item: PnlLineItem, layout: SheetLayout): number | null {
  if (!item.row) return null;
  return item.row[layout] ?? null;
}
