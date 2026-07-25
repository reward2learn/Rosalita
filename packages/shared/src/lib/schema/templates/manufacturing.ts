/**
 * Manufacturing Template Schema
 *
 * Sector: Manufacturing & production
 * W3C Standard: B2MML (Business To Manufacturing Markup Language)
 * schema.org: Manufacturer
 */

import type { W3CSchemaDefinition } from '../types';

export const MANUFACTURING_SCHEMA: W3CSchemaDefinition = {
  templateId: 'manufacturing',
  label: 'Manufacturing',
  description: 'Manufacturing operations: production orders, bill of materials, quality control, inventory lot tracking, throughput analytics.',
  schemaOrgType: 'Manufacturer',
  xsdStandard: 'B2MML',
  defaultColors: { primary: '#bf360c', secondary: '#607d8b' },

  models: [
    {
      name: 'ProductionOrder',
      tableName: 'production_orders',
      schemaOrgMapping: {
        orderNumber: 'orderNumber',
        productCode: 'productID',
        quantity: 'productionQuantity',
        status: 'status',
      },
      fields: [
        { name: 'orderNumber', type: 'string', required: true, unique: true, schemaOrgProperty: 'orderNumber', label: 'Order Number', width: 6 },
        { name: 'productCode', type: 'string', required: true, schemaOrgProperty: 'productID', label: 'Product Code', width: 6 },
        { name: 'quantity', type: 'integer', required: true, schemaOrgProperty: 'productionQuantity', label: 'Quantity', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['planned', 'released', 'in_progress', 'completed', 'on_hold', 'cancelled'], default: 'planned', label: 'Status', width: 6 },
        { name: 'startDate', type: 'date', required: true, label: 'Planned Start', width: 6 },
        { name: 'endDate', type: 'date', label: 'Planned End', width: 6 },
        { name: 'priority', type: 'enum', required: true, enumValues: ['low', 'medium', 'high', 'urgent'], default: 'medium', label: 'Priority', width: 6 },
        { name: 'productionLine', type: 'string', required: true, label: 'Production Line', width: 6 },
      ],
    },
    {
      name: 'BillOfMaterial',
      tableName: 'bill_of_materials',
      fields: [
        { name: 'productCode', type: 'string', required: true, unique: true, label: 'Product Code', width: 6 },
        { name: 'version', type: 'string', required: true, label: 'BOM Version', width: 6 },
        { name: 'components', type: 'json', required: true, label: 'Components', width: 12 },
        { name: 'totalCost', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Total Cost (IDR)', width: 6 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
        { name: 'status', type: 'enum', required: true, enumValues: ['draft', 'active', 'deprecated'], default: 'draft', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'QualityCheck',
      tableName: 'quality_checks',
      fields: [
        { name: 'productionOrderId', type: 'string', required: true, label: 'Production Order ID', width: 6 },
        { name: 'checkType', type: 'enum', required: true, enumValues: ['incoming', 'in_process', 'final', 'random_sample'], label: 'Check Type', width: 6 },
        { name: 'result', type: 'enum', required: true, enumValues: ['pass', 'fail', 'conditional', 'rework'], label: 'Result', width: 6 },
        { name: 'inspector', type: 'string', required: true, label: 'Inspector', width: 6 },
        { name: 'checkedAt', type: 'datetime', required: true, label: 'Checked At', width: 6 },
        { name: 'defectsFound', type: 'integer', default: 0, label: 'Defects Found', width: 6 },
        { name: 'notes', type: 'text', label: 'Notes', width: 12 },
      ],
    },
    {
      name: 'InventoryLot',
      tableName: 'inventory_lots',
      fields: [
        { name: 'lotNumber', type: 'string', required: true, unique: true, label: 'Lot Number', width: 6 },
        { name: 'sku', type: 'string', required: true, label: 'SKU', width: 6 },
        { name: 'quantity', type: 'integer', required: true, label: 'Quantity', width: 6 },
        { name: 'location', type: 'string', label: 'Storage Location', width: 6 },
        { name: 'receivedAt', type: 'datetime', required: true, label: 'Received At', width: 6 },
        { name: 'expiryDate', type: 'date', label: 'Expiry Date', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['quarantined', 'available', 'allocated', 'consumed', 'expired'], default: 'quarantined', label: 'Status', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-MFG-01', title: 'View production orders', auth: 'public', route: '/production', blockTypes: ['dynamic_form'], models: ['ProductionOrder'] },
    { id: 'UC-MFG-02', title: 'Manage production schedule', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['ProductionOrder'] },
    { id: 'UC-MFG-03', title: 'Bill of materials management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['BillOfMaterial'] },
    { id: 'UC-MFG-04', title: 'Quality control checks', auth: 'pin', route: '/quality', blockTypes: ['dynamic_form'], models: ['QualityCheck'] },
    { id: 'UC-MFG-05', title: 'Inventory lot tracking', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['InventoryLot'] },
    { id: 'UC-MFG-06', title: 'Manufacturing throughput dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['ProductionOrder', 'QualityCheck'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'production', title: 'Production', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Production' },
    { slug: 'quality', title: 'Quality', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Quality' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'ProductionOrder' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
