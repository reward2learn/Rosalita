/**
 * E-commerce Retail Template Schema
 *
 * Sector: E-commerce & retail
 * W3C Standard: UBL (Universal Business Language) for orders, GS1 for product data
 * schema.org: Store, Product
 */

import type { W3CSchemaDefinition } from '../types';

export const ECOMMERCE_RETAIL_SCHEMA: W3CSchemaDefinition = {
  templateId: 'ecommerce-retail',
  label: 'E-commerce Retail',
  description: 'E-commerce operations: product catalog, sales orders, customer management, inventory tracking, revenue analytics.',
  schemaOrgType: ['Store', 'Product'],
  xsdStandard: 'UBL, GS1',
  defaultColors: { primary: '#6a1b9a', secondary: '#4caf50' },

  models: [
    {
      name: 'Product',
      tableName: 'products',
      schemaOrgMapping: {
        name: 'name',
        description: 'description',
        price: 'offers.price',
        sku: 'sku',
        brand: 'brand',
        imageUrl: 'image',
        category: 'category',
      },
      fields: [
        { name: 'name', type: 'string', required: true, schemaOrgProperty: 'name', label: 'Product Name', width: 12 },
        { name: 'sku', type: 'string', required: true, unique: true, schemaOrgProperty: 'sku', label: 'SKU', width: 6 },
        { name: 'description', type: 'text', schemaOrgProperty: 'description', label: 'Description', width: 12 },
        { name: 'price', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Price (IDR)', width: 6 },
        { name: 'category', type: 'enum', required: true, enumValues: ['electronics', 'apparel', 'home', 'beauty', 'food', 'sports', 'books', 'other'], label: 'Category', width: 6 },
        { name: 'imageUrl', type: 'string', schemaOrgProperty: 'image', label: 'Image URL', width: 12 },
        { name: 'weight', type: 'decimal', label: 'Weight (kg)', width: 6 },
        { name: 'brand', type: 'string', schemaOrgProperty: 'brand', label: 'Brand', width: 6 },
        { name: 'isActive', type: 'boolean', default: true, label: 'Active', width: 6 },
      ],
    },
    {
      name: 'ProductCategory',
      tableName: 'product_categories',
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, label: 'Category Name', width: 12 },
        { name: 'slug', type: 'string', required: true, unique: true, label: 'Slug', width: 6 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
        { name: 'parentCategory', type: 'string', label: 'Parent Category', width: 6 },
        { name: 'sortOrder', type: 'integer', default: 0, label: 'Sort Order', width: 6 },
      ],
    },
    {
      name: 'SalesOrder',
      tableName: 'sales_orders',
      schemaOrgMapping: {
        orderNumber: 'orderNumber',
        totalAmount: 'totalPaymentDue',
        status: 'orderStatus',
      },
      fields: [
        { name: 'orderNumber', type: 'string', required: true, unique: true, schemaOrgProperty: 'orderNumber', label: 'Order Number', width: 6 },
        { name: 'customerName', type: 'string', required: true, label: 'Customer Name', width: 12 },
        { name: 'customerEmail', type: 'string', required: true, label: 'Customer Email', width: 6 },
        { name: 'items', type: 'json', required: true, label: 'Order Items', width: 12 },
        { name: 'totalAmount', type: 'decimal', required: true, schemaOrgProperty: 'totalPaymentDue', label: 'Total Amount (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['pending', 'paid', 'fulfilled', 'shipped', 'delivered', 'cancelled', 'refunded'], default: 'pending', label: 'Status', width: 6 },
        { name: 'paymentMethod', type: 'enum', enumValues: ['credit_card', 'bank_transfer', 'e_wallet', 'cod', 'qris'], label: 'Payment Method', width: 6 },
        { name: 'shippingAddress', type: 'text', label: 'Shipping Address', width: 12 },
      ],
    },
    {
      name: 'Customer',
      tableName: 'customers',
      schemaOrgMapping: {
        name: 'name',
        email: 'email',
        phone: 'telephone',
      },
      fields: [
        { name: 'name', type: 'string', required: true, schemaOrgProperty: 'name', label: 'Customer Name', width: 12 },
        { name: 'email', type: 'string', required: true, unique: true, schemaOrgProperty: 'email', label: 'Email', width: 6 },
        { name: 'phone', type: 'string', schemaOrgProperty: 'telephone', label: 'Phone', width: 6 },
        { name: 'address', type: 'text', label: 'Address', width: 12 },
        { name: 'loyaltyPoints', type: 'integer', default: 0, label: 'Loyalty Points', width: 6 },
        { name: 'totalOrders', type: 'integer', default: 0, label: 'Total Orders', width: 6 },
        { name: 'lastOrderAt', type: 'datetime', label: 'Last Order Date', width: 6 },
      ],
    },
    {
      name: 'InventoryItem',
      tableName: 'inventory_items',
      fields: [
        { name: 'sku', type: 'string', required: true, unique: true, label: 'SKU', width: 6 },
        { name: 'name', type: 'string', required: true, label: 'Item Name', width: 12 },
        { name: 'quantityOnHand', type: 'integer', required: true, label: 'Quantity On Hand', width: 6 },
        { name: 'reorderLevel', type: 'integer', required: true, label: 'Reorder Level', width: 6 },
        { name: 'location', type: 'string', label: 'Warehouse Location', width: 6 },
        { name: 'lastStockAt', type: 'datetime', label: 'Last Stock Update', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-ECOM-01', title: 'Browse product catalog', auth: 'public', route: '/products', blockTypes: ['dynamic_form'], models: ['Product'] },
    { id: 'UC-ECOM-02', title: 'Manage products', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Product', 'ProductCategory'] },
    { id: 'UC-ECOM-03', title: 'Place sales order', auth: 'public', route: '/orders', blockTypes: ['dynamic_form'], models: ['SalesOrder'] },
    { id: 'UC-ECOM-04', title: 'Inventory management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['InventoryItem'] },
    { id: 'UC-ECOM-05', title: 'Customer management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Customer'] },
    { id: 'UC-ECOM-06', title: 'Sales revenue dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['SalesOrder'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'products', title: 'Products', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Products' },
    { slug: 'orders', title: 'Orders', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Orders' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Product' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
