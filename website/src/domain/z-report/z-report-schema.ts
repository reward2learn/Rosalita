export interface ZReportField {
  key: string;
  label: string;
  type: 'date' | 'time' | 'text' | 'int' | 'amount' | 'datetime';
  required?: boolean;
  pos?: string;
}

export interface ZReportSection {
  id: string;
  title: string;
  fields: ZReportField[];
}

export interface ZReportDepartment {
  id: string;
  label: string;
  shortLabel: string;
  description: string;
  sectionIds?: string[];
  fieldKeys?: string[];
  required: string[];
}

export const Z_REPORT_SECTIONS: ZReportSection[] = [
  {
    id: 'header',
    title: 'Report Header',
    fields: [
      { key: 'report_date', label: 'Report Date', type: 'date', required: true, pos: '29 Jun 2026' },
      { key: 'report_time', label: 'Report Time', type: 'time', pos: '22:02' },
      { key: 'operator', label: 'OP', type: 'text', pos: 'cs.Alit' },
      { key: 'report_no', label: 'Report No', type: 'int', pos: '3934' },
      { key: 'pos_group', label: 'Group', type: 'text', pos: 'All Pos' },
      { key: 'period_start', label: 'Period Start', type: 'datetime', pos: '28/06/2026 22:06:23' },
      { key: 'period_end', label: 'Period End', type: 'datetime', pos: '29/06/2026 22:02:33' },
    ],
  },
  {
    id: 'sales',
    title: 'Sales Summary',
    fields: [
      { key: 'item_sales_qty', label: 'ItemSales (+) Qty', type: 'int', pos: '302' },
      { key: 'item_sales_amount', label: 'ItemSales (+) Amount', type: 'amount', pos: '20,175,000' },
      { key: 'item_discount_qty', label: 'ItemDiscount (-) Qty', type: 'int', pos: '9' },
      { key: 'item_discount_amount', label: 'ItemDiscount (-) Amount', type: 'amount', pos: '124,800' },
      { key: 'bill_discount_qty', label: 'BillDiscount (-) Qty', type: 'int' },
      { key: 'bill_discount_amount', label: 'BillDiscount (-) Amount', type: 'amount' },
      { key: 'foc_items_qty', label: 'FOC Items (-) Qty', type: 'int' },
      { key: 'foc_items_amount', label: 'FOC Items (-) Amount', type: 'amount' },
      { key: 'foc_bill_qty', label: 'FOC Bill (-) Qty', type: 'int' },
      { key: 'foc_bill_amount', label: 'FOC Bill (-) Amount', type: 'amount' },
      { key: 'total_sales', label: 'Total Sales (=)', type: 'amount', required: true, pos: '20,050,200' },
      { key: 'estimated_sales', label: 'Estimated Sales', type: 'amount', pos: '20,050,200' },
    ],
  },
  {
    id: 'media',
    title: 'MEDIA — Payment Methods',
    fields: [
      { key: 'cash_qty', label: 'CASH Qty', type: 'int', pos: '12' },
      { key: 'cash_amount', label: 'CASH Amount', type: 'amount', pos: '4,467,892' },
      { key: 'bca_qty', label: 'BCA Qty', type: 'int', pos: '1' },
      { key: 'bca_amount', label: 'BCA Amount', type: 'amount', pos: '1,301,762' },
      { key: 'gojek_pay_qty', label: 'GOJEK Qty', type: 'int', pos: '1' },
      { key: 'gojek_pay_amount', label: 'GOJEK Amount', type: 'amount', pos: '230,000' },
      { key: 'mandiri_qty', label: 'MANDIRI Qty', type: 'int', pos: '31' },
      { key: 'mandiri_amount', label: 'MANDIRI Amount', type: 'amount', pos: '17,558,721' },
      { key: 'total_card_qty', label: 'TOTAL CARD Qty', type: 'int', pos: '33' },
      { key: 'total_card_amount', label: 'TOTAL CARD Amount', type: 'amount', pos: '19,090,483' },
      { key: 'total_cash_qty', label: 'TOTAL CASH Qty', type: 'int', pos: '12' },
      { key: 'total_cash_amount', label: 'TOTAL CASH Amount', type: 'amount', pos: '4,467,892' },
    ],
  },
  {
    id: 'voids',
    title: 'VOID / REFUND SUMMARY',
    fields: [
      { key: 'refund_qty', label: 'Refund Qty', type: 'int' },
      { key: 'refund_amount', label: 'Refund Amount', type: 'amount' },
      { key: 'pre_send_void_qty', label: 'Pre-Send Void Qty', type: 'int', pos: '12' },
      { key: 'pre_send_void_amount', label: 'Pre-Send Void Amount', type: 'amount', pos: '850,000' },
      { key: 'post_send_void_qty', label: 'Post-Send Void Qty', type: 'int' },
      { key: 'post_send_void_amount', label: 'Post-Send Void Amount', type: 'amount' },
    ],
  },
  {
    id: 'collection',
    title: 'Collection',
    fields: [
      { key: 'tot_collection_qty', label: 'TotCollection Qty', type: 'int', pos: '45' },
      { key: 'tot_collection_amount', label: 'TotCollection Amount', type: 'amount', pos: '23,558,375' },
    ],
  },
  {
    id: 'tax',
    title: 'TAX',
    fields: [
      { key: 'tax_10_amount', label: 'Tax 10%', type: 'amount', pos: '2,120,761' },
      { key: 'service_7_amount', label: 'Service 7%', type: 'amount', pos: '1,387,414' },
      { key: 'nett_sales', label: 'Nett Sales', type: 'amount', required: true, pos: '20,050,200' },
    ],
  },
  {
    id: 'stats',
    title: 'Bills & Covers',
    fields: [
      { key: 'bills_pending_qty', label: 'Bills Pending Qty', type: 'int' },
      { key: 'bills_pending_amount', label: 'Bills Pending Amount', type: 'amount' },
      { key: 'total_bills', label: 'Total # of Bills', type: 'int', required: true, pos: '45' },
      { key: 'avg_bills', label: 'Avg Bills', type: 'amount', pos: '523,519' },
      { key: 'total_covers', label: 'Total # of Covers', type: 'int', required: true, pos: '79' },
      { key: 'avg_covers', label: 'Avg Covers', type: 'amount', pos: '298,207' },
      { key: 'begin_receipt_no', label: 'Begin Receipt#', type: 'text', pos: 'A26000006346' },
      { key: 'end_receipt_no', label: 'End Receipt#', type: 'text', pos: 'A26000006392' },
    ],
  },
  {
    id: 'group_sales',
    title: 'GROUP SALES',
    fields: [
      { key: 'group_beverage_qty', label: 'BEVERAGE Qty', type: 'int', pos: '127' },
      { key: 'group_beverage_amount', label: 'BEVERAGE Amount', type: 'amount', pos: '7,337,000' },
      { key: 'group_food_qty', label: 'FOOD Qty', type: 'int', pos: '175' },
      { key: 'group_food_amount', label: 'FOOD Amount', type: 'amount', pos: '12,838,000' },
      { key: 'group_total_qty', label: 'TOTAL GROUP Qty', type: 'int', pos: '302' },
      { key: 'group_total_amount', label: 'TOTAL GROUP Amount', type: 'amount', pos: '20,175,000' },
    ],
  },
  {
    id: 'group_foc',
    title: 'GROUP FOC',
    fields: [
      { key: 'group_foc_beverage_qty', label: 'BEVERAGE Qty', type: 'int' },
      { key: 'group_foc_beverage_amount', label: 'BEVERAGE Amount', type: 'amount' },
      { key: 'group_foc_food_qty', label: 'FOOD Qty', type: 'int' },
      { key: 'group_foc_food_amount', label: 'FOOD Amount', type: 'amount' },
    ],
  },
  {
    id: 'sales_category',
    title: 'SALES CATEGORY',
    fields: [
      { key: 'dine_in_qty', label: 'DINE IN Qty', type: 'int', pos: '300' },
      { key: 'dine_in_amount', label: 'DINE IN Amount', type: 'amount', pos: '19,945,000' },
      { key: 'gofood_qty', label: 'GO-FOOD Qty', type: 'int', pos: '2' },
      { key: 'gofood_amount', label: 'GO-FOOD Amount', type: 'amount', pos: '230,000' },
      { key: 'total_ctgry_qty', label: 'TOTAL CTGRY Qty', type: 'int', pos: '302' },
      { key: 'total_ctgry_amount', label: 'TOTAL CTGRY Amount', type: 'amount', pos: '20,175,000' },
    ],
  },
  {
    id: 'discounts',
    title: 'DISCOUNT / PROMOTION',
    fields: [
      { key: 'bill_disc_20_qty', label: 'BILL DISC 20% Qty', type: 'int', pos: '9' },
      { key: 'bill_disc_20_amount', label: 'BILL DISC 20% Amount', type: 'amount', pos: '124,800' },
      { key: 'total_item_discount_qty', label: 'TOTAL ItemDiscount Qty', type: 'int', pos: '9' },
      { key: 'total_item_discount_amount', label: 'TOTAL ItemDiscount Amount', type: 'amount', pos: '124,800' },
    ],
  },
];

export const Z_REPORT_FIELD_KEYS = Z_REPORT_SECTIONS.flatMap((s) => s.fields.map((f) => f.key));

export const Z_REPORT_REQUIRED = Z_REPORT_SECTIONS.flatMap((s) =>
  s.fields.filter((f) => f.required).map((f) => f.key),
);

export function isPosReceiptField(field: ZReportField | null | undefined): boolean {
  return field != null && field.pos != null && String(field.pos).trim() !== '';
}

export function filterReceiptSections(sections: ZReportSection[]): ZReportSection[] {
  return sections
    .map((section) => ({
      ...section,
      fields: section.fields.filter(isPosReceiptField),
    }))
    .filter((section) => section.fields.length > 0);
}

export const Z_REPORT_RECEIPT_SECTIONS = filterReceiptSections(Z_REPORT_SECTIONS);

const HEADER_RECEIPT_KEYS = [
  'report_date', 'report_time', 'operator', 'report_no', 'pos_group', 'period_start', 'period_end',
];

export const Z_REPORT_DEPARTMENTS: ZReportDepartment[] = [
  {
    id: 'all_pos',
    label: 'All POS — Full Z Report',
    shortLabel: 'All POS',
    description: 'Complete Z Sales Day Report printout (All Pos terminal).',
    sectionIds: Z_REPORT_SECTIONS.map((s) => s.id),
    required: ['report_date', 'nett_sales', 'total_covers'],
  },
  {
    id: 'food',
    label: 'Kitchen / Food',
    shortLabel: 'Food',
    description: 'Food group sales and dine-in category from the Z report.',
    sectionIds: ['header', 'group_sales', 'sales_category', 'discounts', 'tax'],
    fieldKeys: [
      ...HEADER_RECEIPT_KEYS,
      'group_food_qty', 'group_food_amount',
      'dine_in_qty', 'dine_in_amount',
      'bill_disc_20_qty', 'bill_disc_20_amount',
      'total_item_discount_qty', 'total_item_discount_amount',
      'tax_10_amount', 'service_7_amount', 'nett_sales',
    ],
    required: ['report_date', 'group_food_amount'],
  },
  {
    id: 'beverage',
    label: 'Bar / Beverage',
    shortLabel: 'Beverage',
    description: 'Beverage group sales from the Z report.',
    sectionIds: ['header', 'group_sales', 'tax'],
    fieldKeys: [
      ...HEADER_RECEIPT_KEYS,
      'group_beverage_qty', 'group_beverage_amount',
      'tax_10_amount', 'service_7_amount', 'nett_sales',
    ],
    required: ['report_date', 'group_beverage_amount'],
  },
  {
    id: 'gofood',
    label: 'GoFood / Delivery',
    shortLabel: 'GoFood',
    description: 'GoFood sales category from the Z report.',
    sectionIds: ['header', 'sales_category', 'media', 'tax'],
    fieldKeys: [
      ...HEADER_RECEIPT_KEYS,
      'gofood_qty', 'gofood_amount',
      'gojek_pay_qty', 'gojek_pay_amount',
      'tax_10_amount', 'service_7_amount', 'nett_sales',
    ],
    required: ['report_date', 'gofood_amount'],
  },
];

export function getDepartment(deptId: string): ZReportDepartment {
  return Z_REPORT_DEPARTMENTS.find((d) => d.id === deptId) ?? Z_REPORT_DEPARTMENTS[0]!;
}

export function sectionsForDepartment(deptId: string, receiptOnly = false): ZReportSection[] {
  const dept = getDepartment(deptId);
  const base = receiptOnly ? Z_REPORT_RECEIPT_SECTIONS : Z_REPORT_SECTIONS;
  const keySet = dept.fieldKeys ? new Set(dept.fieldKeys) : null;
  return base
    .filter((section) => !dept.sectionIds || dept.sectionIds.includes(section.id))
    .map((section) => ({
      ...section,
      fields: section.fields.filter((f) => !keySet || keySet.has(f.key)),
    }))
    .filter((section) => section.fields.length > 0);
}

export function requiredForDepartment(deptId: string): string[] {
  return getDepartment(deptId).required ?? Z_REPORT_REQUIRED;
}

export function legacyAliases(row: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!row) return row;
  return {
    ...row,
    date: row.report_date,
    revenue: row.nett_sales ?? row.total_sales,
    guests_count: row.total_covers,
    avg_spend: row.avg_covers,
    gofood_revenue: row.gofood_amount,
    direct_orders: row.dine_in_amount,
  };
}
