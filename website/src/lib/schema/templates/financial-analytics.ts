/**
 * Financial Analytics Template Schema
 *
 * Sector: Financial performance tracking
 * W3C Standard: FpML (Financial Products Markup Language), FIXML
 * schema.org: FinancialService
 *
 * This is the reference template — extracted from the existing
 * nightclub-bar/financial-analytics schema models.
 */

import type { W3CSchemaDefinition } from '../types';

export const FINANCIAL_ANALYTICS_SCHEMA: W3CSchemaDefinition = {
  templateId: 'financial-analytics',
  label: 'Financial Analytics',
  description: 'Financial performance tracking: revenue analysis, BEP modeling, P&L projections, KPI monitoring, executive reporting.',
  schemaOrgType: 'FinancialService',
  xsdStandard: 'FpML, FIXML',
  defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },

  models: [
    {
      name: 'FinancialProjection',
      tableName: 'financial_projections',
      schemaOrgMapping: {
        period: 'fiscalPeriod',
        revenue: 'income',
        ebitda: 'profit',
      },
      fields: [
        { name: 'period', type: 'string', required: true, label: 'Period', width: 6 },
        { name: 'year', type: 'integer', required: true, label: 'Year', width: 6 },
        { name: 'month', type: 'integer', required: true, label: 'Month', width: 6 },
        { name: 'dataType', type: 'enum', required: true, enumValues: ['actual', 'forecast'], label: 'Data Type', width: 6 },
        { name: 'scenario', type: 'enum', required: true, enumValues: ['conservative', 'realistic', 'aspirational'], label: 'Scenario', width: 6 },
        { name: 'revenue', type: 'decimal', required: true, schemaOrgProperty: 'income', label: 'Revenue (IDR)', width: 6 },
        { name: 'ebitda', type: 'decimal', required: true, schemaOrgProperty: 'profit', label: 'EBITDA (IDR)', width: 6 },
        { name: 'netIncome', type: 'decimal', required: true, label: 'Net Income (IDR)', width: 6 },
        { name: 'guests', type: 'integer', required: true, label: 'Guests', width: 6 },
        { name: 'staffCost', type: 'decimal', required: true, label: 'Staff Cost (IDR)', width: 6 },
        { name: 'pnlLines', type: 'json', label: 'P&L Lines', width: 12 },
      ],
    },
    {
      name: 'DailyZReport',
      tableName: 'daily_z_reports',
      schemaOrgMapping: {
        reportDate: 'dateRecorded',
        totalSales: 'totalPaymentDue',
      },
      fields: [
        { name: 'reportDate', type: 'date', required: true, schemaOrgProperty: 'dateRecorded', label: 'Report Date', width: 6 },
        { name: 'department', type: 'string', required: true, default: 'all_pos', label: 'Department', width: 6 },
        { name: 'operator', type: 'string', label: 'Operator', width: 6 },
        { name: 'reportNo', type: 'integer', label: 'Report No.', width: 6 },
        { name: 'totalSales', type: 'decimal', required: true, schemaOrgProperty: 'totalPaymentDue', label: 'Total Sales (IDR)', width: 6 },
        { name: 'cashAmount', type: 'decimal', label: 'Cash (IDR)', width: 6 },
        { name: 'bcaAmount', type: 'decimal', label: 'BCA (IDR)', width: 6 },
        { name: 'gojekPayAmount', type: 'decimal', label: 'Gojek Pay (IDR)', width: 6 },
        { name: 'itemSalesQty', type: 'integer', label: 'Item Sales Qty', width: 6 },
        { name: 'itemSalesAmount', type: 'decimal', label: 'Item Sales (IDR)', width: 6 },
      ],
    },
    {
      name: 'BusinessReviewPart',
      tableName: 'business_review_parts',
      fields: [
        { name: 'partKey', type: 'string', required: true, unique: true, label: 'Part Key (A-O)', width: 6 },
        { name: 'slug', type: 'string', required: true, unique: true, label: 'Slug', width: 6 },
        { name: 'title', type: 'string', required: true, label: 'Title', width: 12 },
        { name: 'sortOrder', type: 'integer', required: true, label: 'Sort Order', width: 6 },
        { name: 'markdown', type: 'text', required: true, label: 'Markdown Content', width: 12 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-FIN-01', title: 'Record daily POS Z-report', auth: 'pin', route: '/ops-admin', blockTypes: ['z_report_form'], models: ['DailyZReport'] },
    { id: 'UC-FIN-02', title: 'View multi-scenario P&L projections', auth: 'google', route: '/dashboard', blockTypes: ['chart_financial'], models: ['FinancialProjection'] },
    { id: 'UC-FIN-03', title: 'Business review Parts A-O', auth: 'google', route: '/review', blockTypes: ['review_blocks'], models: ['BusinessReviewPart'] },
    { id: 'UC-FIN-04', title: 'Executive summary', auth: 'google', route: '/summary', blockTypes: ['doc_markdown'], models: [] },
    { id: 'UC-FIN-05', title: 'Ops tracking dashboard', auth: 'pin', route: '/ops-tracking', blockTypes: ['kpi_cards', 'sheet_viewer'], models: ['FinancialProjection'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'review', title: 'Business Review', authTier: 'google', blockTypes: ['review_blocks'], navLabel: 'Review' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'ops-admin', title: 'Ops Admin', authTier: 'pin', blockTypes: ['ops_admin_tabs', 'z_report_form', 'costs_form'], navLabel: 'Ops Admin' },
    { slug: 'ops-tracking', title: 'Ops Tracking', authTier: 'pin', blockTypes: ['kpi_cards', 'sheet_viewer'], navLabel: 'Ops Tracking' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'lever_accordion', label: 'Lever Accordion' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
    { type: 'pnl_table', label: 'P&L Table' },
    { type: 'ops_admin_tabs', label: 'Ops Admin Tabs' },
    { type: 'z_report_form', label: 'Z-Report Form' },
    { type: 'costs_form', label: 'Costs Form' },
    { type: 'review_blocks', label: 'Review Blocks' },
    { type: 'reports_rollup', label: 'Reports Rollup' },
    { type: 'sheet_viewer', label: 'Sheet Viewer' },
  ],
};
