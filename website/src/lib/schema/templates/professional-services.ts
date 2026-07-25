/**
 * Professional Services Template Schema
 *
 * Sector: Professional services & consulting
 * W3C Standard: UBL (Universal Business Language) for billing & invoices
 * schema.org: ProfessionalService
 */

import type { W3CSchemaDefinition } from '../types';

export const PROFESSIONAL_SERVICES_SCHEMA: W3CSchemaDefinition = {
  templateId: 'professional-services',
  label: 'Professional Services',
  description: 'Professional services: project management, time tracking, client billing, invoice generation, deliverable tracking.',
  schemaOrgType: 'ProfessionalService',
  xsdStandard: 'UBL Billing',
  defaultColors: { primary: '#455a64', secondary: '#e91e63' },

  models: [
    {
      name: 'Project',
      tableName: 'projects',
      schemaOrgMapping: {
        name: 'name',
        description: 'description',
        budget: 'offers.price',
        status: 'status',
      },
      fields: [
        { name: 'name', type: 'string', required: true, schemaOrgProperty: 'name', label: 'Project Name', width: 12 },
        { name: 'clientId', type: 'string', required: true, label: 'Client ID', width: 6 },
        { name: 'description', type: 'text', schemaOrgProperty: 'description', label: 'Description', width: 12 },
        { name: 'status', type: 'enum', required: true, enumValues: ['planning', 'active', 'on_hold', 'completed', 'cancelled'], default: 'planning', label: 'Status', width: 6 },
        { name: 'startDate', type: 'date', required: true, label: 'Start Date', width: 6 },
        { name: 'endDate', type: 'date', label: 'End Date', width: 6 },
        { name: 'budget', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Budget (IDR)', width: 6 },
        { name: 'hourlyRate', type: 'decimal', label: 'Hourly Rate (IDR)', width: 6 },
      ],
    },
    {
      name: 'TimeEntry',
      tableName: 'time_entries',
      fields: [
        { name: 'projectId', type: 'string', required: true, label: 'Project ID', width: 6 },
        { name: 'entryDate', type: 'date', required: true, label: 'Date', width: 6 },
        { name: 'hours', type: 'decimal', required: true, label: 'Hours', width: 6 },
        { name: 'description', type: 'text', required: true, label: 'Description', width: 12 },
        { name: 'billable', type: 'boolean', default: true, label: 'Billable', width: 6 },
        { name: 'rate', type: 'decimal', label: 'Rate (IDR/hr)', width: 6 },
        { name: 'consultantName', type: 'string', required: true, label: 'Consultant', width: 6 },
      ],
    },
    {
      name: 'Invoice',
      tableName: 'invoices',
      schemaOrgMapping: {
        invoiceNumber: 'confirmationNumber',
        total: 'totalPaymentDue',
        status: 'paymentStatus',
      },
      fields: [
        { name: 'clientId', type: 'string', required: true, label: 'Client ID', width: 6 },
        { name: 'invoiceNumber', type: 'string', required: true, unique: true, schemaOrgProperty: 'confirmationNumber', label: 'Invoice Number', width: 6 },
        { name: 'issueDate', type: 'date', required: true, label: 'Issue Date', width: 6 },
        { name: 'dueDate', type: 'date', required: true, label: 'Due Date', width: 6 },
        { name: 'lineItems', type: 'json', required: true, label: 'Line Items', width: 12 },
        { name: 'subtotal', type: 'decimal', required: true, label: 'Subtotal (IDR)', width: 6 },
        { name: 'tax', type: 'decimal', required: true, label: 'Tax (IDR)', width: 6 },
        { name: 'total', type: 'decimal', required: true, schemaOrgProperty: 'totalPaymentDue', label: 'Total (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['draft', 'sent', 'paid', 'overdue', 'cancelled'], default: 'draft', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'Client',
      tableName: 'clients',
      schemaOrgMapping: {
        name: 'name',
        email: 'email',
        phone: 'telephone',
      },
      fields: [
        { name: 'name', type: 'string', required: true, unique: true, schemaOrgProperty: 'name', label: 'Client Name', width: 12 },
        { name: 'email', type: 'string', required: true, schemaOrgProperty: 'email', label: 'Email', width: 6 },
        { name: 'phone', type: 'string', schemaOrgProperty: 'telephone', label: 'Phone', width: 6 },
        { name: 'company', type: 'string', label: 'Company', width: 6 },
        { name: 'address', type: 'text', label: 'Address', width: 12 },
        { name: 'industry', type: 'enum', enumValues: ['technology', 'finance', 'healthcare', 'retail', 'manufacturing', 'construction', 'other'], label: 'Industry', width: 6 },
        { name: 'contactName', type: 'string', label: 'Primary Contact', width: 6 },
      ],
    },
    {
      name: 'Deliverable',
      tableName: 'project_deliverables',
      fields: [
        { name: 'projectId', type: 'string', required: true, label: 'Project ID', width: 6 },
        { name: 'title', type: 'string', required: true, label: 'Deliverable Title', width: 12 },
        { name: 'description', type: 'text', label: 'Description', width: 12 },
        { name: 'dueDate', type: 'date', required: true, label: 'Due Date', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['not_started', 'in_progress', 'review', 'delivered', 'accepted'], default: 'not_started', label: 'Status', width: 6 },
        { name: 'deliveredAt', type: 'datetime', label: 'Delivered At', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-PS-01', title: 'View projects', auth: 'public', route: '/projects', blockTypes: ['dynamic_form'], models: ['Project'] },
    { id: 'UC-PS-02', title: 'Manage projects', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Project', 'Deliverable'] },
    { id: 'UC-PS-03', title: 'Time tracking', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['TimeEntry'] },
    { id: 'UC-PS-04', title: 'Invoice management', auth: 'pin', route: '/invoices', blockTypes: ['dynamic_form'], models: ['Invoice'] },
    { id: 'UC-PS-05', title: 'Client management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Client'] },
    { id: 'UC-PS-06', title: 'Firm performance dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['Project', 'Invoice'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'projects', title: 'Projects', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Projects' },
    { slug: 'invoices', title: 'Invoices', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Invoices' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Project' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};
