/**
 * Real Estate Template Schema
 *
 * Sector: Real estate & property management
 * W3C Standard: RETS (Real Estate Transaction Standard)
 * schema.org: RealEstateAgent
 */

import type { W3CSchemaDefinition } from '../types';

export const REAL_ESTATE_SCHEMA: W3CSchemaDefinition = {
  templateId: 'real-estate',
  label: 'Real Estate',
  description: 'Real estate operations: property listings, lease management, tenant tracking, maintenance requests, portfolio analytics.',
  schemaOrgType: 'RealEstateAgent',
  xsdStandard: 'RETS',
  defaultColors: { primary: '#5d4037', secondary: '#2196f3' },

  models: [
    {
      name: 'Property',
      tableName: 'properties',
      schemaOrgMapping: {
        address: 'address',
        propertyType: 'additionalType',
        bedrooms: 'numberOfRooms',
        squareFeet: 'floorSize',
        imageUrl: 'image',
      },
      fields: [
        { name: 'address', type: 'string', required: true, unique: true, schemaOrgProperty: 'address', label: 'Address', width: 12 },
        { name: 'propertyType', type: 'enum', required: true, enumValues: ['apartment', 'house', 'villa', 'commercial', 'office', 'land', 'townhouse'], schemaOrgProperty: 'additionalType', label: 'Property Type', width: 6 },
        { name: 'bedrooms', type: 'integer', schemaOrgProperty: 'numberOfRooms', label: 'Bedrooms', width: 6 },
        { name: 'bathrooms', type: 'integer', label: 'Bathrooms', width: 6 },
        { name: 'squareFeet', type: 'integer', schemaOrgProperty: 'floorSize', label: 'Floor Area (sqm)', width: 6 },
        { name: 'lotSize', type: 'integer', label: 'Lot Size (sqm)', width: 6 },
        { name: 'yearBuilt', type: 'integer', label: 'Year Built', width: 6 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
        { name: 'imageUrl', type: 'string', schemaOrgProperty: 'image', label: 'Image URL', width: 12 },
      ],
    },
    {
      name: 'Listing',
      tableName: 'property_listings',
      fields: [
        { name: 'propertyId', type: 'string', required: true, label: 'Property ID', width: 6 },
        { name: 'listingPrice', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Listing Price (IDR)', width: 6 },
        { name: 'listingType', type: 'enum', required: true, enumValues: ['sale', 'rent', 'lease'], label: 'Listing Type', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['active', 'pending', 'sold', 'rented', 'expired', 'withdrawn'], default: 'active', label: 'Status', width: 6 },
        { name: 'listedAt', type: 'date', required: true, label: 'Listed Date', width: 6 },
        { name: 'agentName', type: 'string', required: true, label: 'Listing Agent', width: 6 },
        { name: 'description', type: 'text', label: 'Listing Description', width: 12 },
      ],
    },
    {
      name: 'Lease',
      tableName: 'lease_agreements',
      fields: [
        { name: 'propertyId', type: 'string', required: true, label: 'Property ID', width: 6 },
        { name: 'tenantId', type: 'string', required: true, label: 'Tenant ID', width: 6 },
        { name: 'startDate', type: 'date', required: true, label: 'Lease Start', width: 6 },
        { name: 'endDate', type: 'date', required: true, label: 'Lease End', width: 6 },
        { name: 'monthlyRent', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Monthly Rent (IDR)', width: 6 },
        { name: 'deposit', type: 'decimal', required: true, label: 'Deposit (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['active', 'expired', 'terminated', 'pending_renewal'], default: 'active', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'Tenant',
      tableName: 'tenants',
      fields: [
        { name: 'name', type: 'string', required: true, label: 'Tenant Name', width: 12 },
        { name: 'email', type: 'string', required: true, label: 'Email', width: 6 },
        { name: 'phone', type: 'string', label: 'Phone', width: 6 },
        { name: 'currentAddress', type: 'text', label: 'Current Address', width: 12 },
        { name: 'employmentStatus', type: 'enum', enumValues: ['employed', 'self_employed', 'unemployed', 'retired', 'student'], label: 'Employment Status', width: 6 },
        { name: 'monthlyIncome', type: 'decimal', label: 'Monthly Income (IDR)', width: 6 },
      ],
    },
    {
      name: 'MaintenanceRequest',
      tableName: 'maintenance_requests',
      fields: [
        { name: 'propertyId', type: 'string', required: true, label: 'Property ID', width: 6 },
        { name: 'requestType', type: 'enum', required: true, enumValues: ['plumbing', 'electrical', 'hvac', 'appliance', 'structural', 'pest_control', 'other'], label: 'Request Type', width: 6 },
        { name: 'description', type: 'text', required: true, label: 'Description', width: 12 },
        { name: 'priority', type: 'enum', required: true, enumValues: ['low', 'medium', 'high', 'urgent'], default: 'medium', label: 'Priority', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['open', 'assigned', 'in_progress', 'completed', 'cancelled'], default: 'open', label: 'Status', width: 6 },
        { name: 'requestedAt', type: 'datetime', required: true, label: 'Requested At', width: 6 },
        { name: 'completedAt', type: 'datetime', label: 'Completed At', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-RE-01', title: 'Browse property listings', auth: 'public', route: '/properties', blockTypes: ['dynamic_form'], models: ['Property', 'Listing'] },
    { id: 'UC-RE-02', title: 'Manage properties', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Property'] },
    { id: 'UC-RE-03', title: 'Create & manage listings', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Listing'] },
    { id: 'UC-RE-04', title: 'Lease management', auth: 'pin', route: '/leases', blockTypes: ['dynamic_form'], models: ['Lease', 'Tenant'] },
    { id: 'UC-RE-05', title: 'Maintenance request tracking', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['MaintenanceRequest'] },
    { id: 'UC-RE-06', title: 'Portfolio performance dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['Lease', 'Listing'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'properties', title: 'Properties', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Properties' },
    { slug: 'leases', title: 'Leases', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Leases' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Property' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
