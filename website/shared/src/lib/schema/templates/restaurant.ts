/**
 * Restaurant Template Schema
 *
 * Sector: Restaurant & food service
 * W3C Standard: UBL (Universal Business Language) for invoices/orders, GS1 for product data
 * schema.org: Restaurant
 */

import type { W3CSchemaDefinition } from '../types';

export const RESTAURANT_SCHEMA: W3CSchemaDefinition = {
  templateId: 'restaurant',
  label: 'Restaurant',
  description: 'Restaurant operations: menu management, table reservations, daily covers, food cost analysis, GoFood integration.',
  schemaOrgType: 'Restaurant',
  xsdStandard: 'UBL, GS1',
  defaultColors: { primary: '#2e7d32', secondary: '#ff8f00' },

  models: [
    {
      name: 'MenuItem',
      tableName: 'menu_items',
      schemaOrgMapping: {
        name: 'name',
        description: 'description',
        price: 'offers.price',
        currency: 'offers.priceCurrency',
        image: 'image',
        isAvailable: 'availability',
      },
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, schemaOrgProperty: 'name', label: 'Item Name', width: 12 },
        { name: 'description', type: 'text', schemaOrgProperty: 'description', label: 'Description', width: 12 },
        { name: 'price', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Price (IDR)', width: 6 },
        { name: 'currency', type: 'string', required: true, default: 'IDR', schemaOrgProperty: 'offers.priceCurrency', label: 'Currency', width: 6 },
        { name: 'category', type: 'enum', required: true, enumValues: ['appetizer', 'main', 'dessert', 'beverage', 'side'], label: 'Category', width: 6 },
        { name: 'imageUrl', type: 'string', schemaOrgProperty: 'image', label: 'Image URL', width: 12 },
        { name: 'isAvailable', type: 'boolean', default: true, schemaOrgProperty: 'availability', label: 'Available', width: 6 },
        { name: 'allergens', type: 'json', default: [], schemaOrgProperty: 'suitableForDiet', label: 'Allergens', width: 12 },
        { name: 'calories', type: 'integer', schemaOrgProperty: 'nutrition.calories', label: 'Calories', width: 6 },
        { name: 'sortOrder', type: 'integer', default: 0, label: 'Sort Order', width: 6 },
      ],
    },
    {
      name: 'TableReservation',
      tableName: 'table_reservations',
      schemaOrgMapping: {
        reservationFor: 'reservationFor',
        startTime: 'startTime',
        partySize: 'partySize',
      },
      fields: [
        { name: 'customerName', type: 'string', required: true, label: 'Customer Name', width: 12 },
        { name: 'customerEmail', type: 'string', required: true, label: 'Email', width: 6 },
        { name: 'customerPhone', type: 'string', label: 'Phone', width: 6 },
        { name: 'partySize', type: 'integer', required: true, schemaOrgProperty: 'partySize', label: 'Party Size', width: 6 },
        { name: 'reservationDate', type: 'datetime', required: true, schemaOrgProperty: 'startTime', label: 'Date & Time', width: 6 },
        { name: 'tableNumber', type: 'string', label: 'Table Number', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['pending', 'confirmed', 'seated', 'completed', 'cancelled'], default: 'pending', label: 'Status', width: 6 },
        { name: 'specialRequests', type: 'text', label: 'Special Requests', width: 12 },
      ],
    },
    {
      name: 'DailyCovers',
      tableName: 'daily_covers',
      fields: [
        { name: 'reportDate', type: 'date', required: true, label: 'Date', width: 6 },
        { name: 'lunchCovers', type: 'integer', required: true, label: 'Lunch Covers', width: 6 },
        { name: 'dinnerCovers', type: 'integer', required: true, label: 'Dinner Covers', width: 6 },
        { name: 'totalCovers', type: 'integer', required: true, label: 'Total Covers', width: 6 },
        { name: 'averageCheck', type: 'decimal', label: 'Avg Check (IDR)', width: 6 },
        { name: 'revenue', type: 'decimal', label: 'Revenue (IDR)', width: 6 },
        { name: 'weather', type: 'enum', enumValues: ['sunny', 'cloudy', 'rainy', 'stormy'], label: 'Weather', width: 6 },
        { name: 'notes', type: 'text', label: 'Notes', width: 12 },
      ],
    },
    {
      name: 'GoFoodOrder',
      tableName: 'gofood_orders',
      fields: [
        { name: 'orderId', type: 'string', required: true, unique: true, label: 'GoFood Order ID', width: 12 },
        { name: 'customerName', type: 'string', required: true, label: 'Customer', width: 12 },
        { name: 'items', type: 'json', required: true, label: 'Order Items', width: 12 },
        { name: 'totalAmount', type: 'decimal', required: true, label: 'Total (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['new', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'], default: 'new', label: 'Status', width: 6 },
        { name: 'orderTime', type: 'datetime', required: true, label: 'Order Time', width: 6 },
        { name: 'deliveryFee', type: 'decimal', label: 'Delivery Fee (IDR)', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-REST-01', title: 'View menu', auth: 'public', route: '/menu', blockTypes: ['dynamic_form'], models: ['MenuItem'] },
    { id: 'UC-REST-02', title: 'Manage menu items', auth: 'pin', route: '/admin/menu', blockTypes: ['dynamic_form'], models: ['MenuItem'] },
    { id: 'UC-REST-03', title: 'Table reservation', auth: 'public', route: '/reservations', blockTypes: ['dynamic_form'], models: ['TableReservation'] },
    { id: 'UC-REST-04', title: 'Daily covers tracking', auth: 'pin', route: '/ops-admin', blockTypes: ['dynamic_form'], models: ['DailyCovers'] },
    { id: 'UC-REST-05', title: 'GoFood order sync', auth: 'pin', route: '/ops-admin', blockTypes: ['dynamic_form'], models: ['GoFoodOrder'] },
    { id: 'UC-REST-06', title: 'Financial dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: [] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'menu', title: 'Menu', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Menu' },
    { slug: 'reservations', title: 'Reservations', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Reservations' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['ops_admin_tabs'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'MenuItem' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
