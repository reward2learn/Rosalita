/**
 * Supply Chain Template Schema
 *
 * Sector: Supply chain & logistics
 * W3C Standard: UBL (Universal Business Language) for shipping, B2B logistics
 * schema.org: DeliveryEvent, ParcelDelivery
 */

import type { W3CSchemaDefinition } from '../types';

export const SUPPLY_CHAIN_SCHEMA: W3CSchemaDefinition = {
  templateId: 'supply-chain',
  label: 'Supply Chain',
  description: 'Supply chain operations: shipment tracking, warehouse inventory, carrier management, delivery logistics.',
  schemaOrgType: ['DeliveryEvent', 'ParcelDelivery'],
  xsdStandard: 'UBL Shipping',
  defaultColors: { primary: '#37474f', secondary: '#ff9800' },

  models: [
    {
      name: 'Shipment',
      tableName: 'shipments',
      schemaOrgMapping: {
        trackingNumber: 'trackingNumber',
        origin: 'originAddress',
        destination: 'deliveryAddress',
        status: 'deliveryStatus',
        shippedAt: 'deliveryTime',
      },
      fields: [
        { name: 'trackingNumber', type: 'string', required: true, unique: true, schemaOrgProperty: 'trackingNumber', label: 'Tracking Number', width: 6 },
        { name: 'origin', type: 'string', required: true, schemaOrgProperty: 'originAddress', label: 'Origin', width: 6 },
        { name: 'destination', type: 'string', required: true, schemaOrgProperty: 'deliveryAddress', label: 'Destination', width: 6 },
        { name: 'carrierId', type: 'string', required: true, label: 'Carrier ID', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['pending', 'picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception', 'returned'], default: 'pending', schemaOrgProperty: 'deliveryStatus', label: 'Status', width: 6 },
        { name: 'shippedAt', type: 'datetime', required: true, label: 'Shipped At', width: 6 },
        { name: 'estimatedDelivery', type: 'datetime', label: 'Estimated Delivery', width: 6 },
        { name: 'actualDelivery', type: 'datetime', label: 'Actual Delivery', width: 6 },
        { name: 'weight', type: 'decimal', label: 'Weight (kg)', width: 6 },
        { name: 'cost', type: 'decimal', schemaOrgProperty: 'offers.price', label: 'Shipping Cost (IDR)', width: 6 },
      ],
    },
    {
      name: 'TrackingEvent',
      tableName: 'tracking_events',
      fields: [
        { name: 'shipmentId', type: 'string', required: true, label: 'Shipment ID', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['picked_up', 'in_transit', 'out_for_delivery', 'delivered', 'exception'], label: 'Status', width: 6 },
        { name: 'location', type: 'string', required: true, label: 'Location', width: 6 },
        { name: 'timestamp', type: 'datetime', required: true, label: 'Timestamp', width: 6 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
      ],
    },
    {
      name: 'WarehouseItem',
      tableName: 'warehouse_items',
      fields: [
        { name: 'sku', type: 'string', required: true, unique: true, label: 'SKU', width: 6 },
        { name: 'name', type: 'string', required: true, label: 'Item Name', width: 12 },
        { name: 'quantity', type: 'integer', required: true, label: 'Quantity', width: 6 },
        { name: 'location', type: 'string', label: 'Warehouse Location', width: 6 },
        { name: 'aisle', type: 'string', label: 'Aisle', width: 6 },
        { name: 'bin', type: 'string', label: 'Bin', width: 6 },
        { name: 'receivedAt', type: 'datetime', label: 'Received At', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['in_stock', 'reserved', 'shipped', 'damaged', 'returned'], default: 'in_stock', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'Carrier',
      tableName: 'carriers',
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, label: 'Carrier Name', width: 12 },
        { name: 'code', type: 'string', required: true, unique: true, label: 'Carrier Code', width: 6 },
        { name: 'contactPhone', type: 'string', label: 'Contact Phone', width: 6 },
        { name: 'serviceType', type: 'enum', required: true, enumValues: ['standard', 'express', 'same_day', 'freight', 'international'], default: 'standard', label: 'Service Type', width: 6 },
        { name: 'trackingUrl', type: 'string', label: 'Tracking URL Template', width: 12 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-SC-01', title: 'Track shipment', auth: 'public', route: '/shipments', blockTypes: ['dynamic_form'], models: ['Shipment', 'TrackingEvent'] },
    { id: 'UC-SC-02', title: 'Manage shipments', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Shipment'] },
    { id: 'UC-SC-03', title: 'Warehouse inventory management', auth: 'pin', route: '/warehouse', blockTypes: ['dynamic_form'], models: ['WarehouseItem'] },
    { id: 'UC-SC-04', title: 'Carrier management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Carrier'] },
    { id: 'UC-SC-05', title: 'Logistics operations dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['Shipment'] },
    { id: 'UC-SC-06', title: 'Executive summary', auth: 'google', route: '/summary', blockTypes: ['doc_markdown'], models: [] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'shipments', title: 'Shipments', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Shipments' },
    { slug: 'warehouse', title: 'Warehouse', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Warehouse' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Shipment' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
