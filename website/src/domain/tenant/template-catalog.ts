/**
 * Template Catalog — defines available app templates with default configurations.
 *
 * 10 business sector templates derived from W3C XML Schema (XSD) standards
 * and schema.org types. Each template specifies default pages, navigation,
 * brand presets, W3C standard alignment, and schema.org structured data type.
 */

export interface TemplateDefinition {
  id: string;
  label: string;
  description: string;
  icon: string; // MUI icon name
  defaultColors: { primary: string; secondary: string };
  defaultPages: {
    slug: string;
    title: string;
    navLabel?: string;
    authTier: 'public' | 'pin' | 'google';
    blockTypes: string[];
  }[];
  defaultNavItems: {
    title: string;
    path: string;
    icon: string;
    authTier: 'public' | 'pin' | 'google';
  }[];
  /** schema.org type for JSON-LD structured data */
  schemaOrgType: string | string[];
  /** W3C XSD standard alignment */
  xsdStandard: string;
}

// ── Shared page definitions ─────────────────────────────

const DASHBOARD_PAGE = (blockTypes: string[] = ['hero', 'kpi_cards', 'chart_financial']) => ({
  slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public' as const, blockTypes,
});
const SUMMARY_PAGE = {
  slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google' as const,
  blockTypes: ['doc_markdown'],
};
const TASKS_PAGE = {
  slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin' as const,
  blockTypes: ['action_checklist'],
};
const ADMIN_PAGE = {
  slug: 'admin', title: 'Admin', navLabel: 'Admin', authTier: 'pin' as const,
  blockTypes: ['ops_admin_tabs'],
};

const BASIC_NAV = [
  { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' as const },
  { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' as const },
  { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' as const },
];

// ── Template Catalog (10 business sectors) ──────────────

export const TEMPLATE_CATALOG: Record<string, TemplateDefinition> = {
  // 1. Financial Analytics (reclassified from nightclub-bar)
  'financial-analytics': {
    id: 'financial-analytics',
    label: 'Financial Analytics',
    description: 'Financial performance tracking: revenue analysis, BEP modeling, P&L projections, KPI monitoring, executive reporting.',
    icon: 'Analytics',
    defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      SUMMARY_PAGE,
      { slug: 'review', title: 'Business Review', navLabel: 'Review', authTier: 'google', blockTypes: ['review_blocks'] },
      TASKS_PAGE,
      { slug: 'ops-admin', title: 'Ops Admin', navLabel: 'Ops Admin', authTier: 'pin', blockTypes: ['ops_admin_tabs', 'z_report_form', 'costs_form'] },
      { slug: 'ops-tracking', title: 'Ops Tracking', navLabel: 'Ops Tracking', authTier: 'pin', blockTypes: ['kpi_cards', 'sheet_viewer'] },
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Business Review', path: '/review', icon: 'Description', authTier: 'google' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Ops Admin', path: '/ops-admin', icon: 'AdminPanelSettings', authTier: 'pin' },
      { title: 'Ops Tracking', path: '/ops-tracking', icon: 'TrackChanges', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'FinancialService',
    xsdStandard: 'FpML, FIXML',
  },

  // 2. Restaurant
  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Restaurant operations: menu management, table reservations, daily covers, food cost analysis, GoFood integration.',
    icon: 'Restaurant',
    defaultColors: { primary: '#2e7d32', secondary: '#ff8f00' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'menu', title: 'Menu', navLabel: 'Menu', authTier: 'public', blockTypes: ['dynamic_form'] },
      { slug: 'reservations', title: 'Reservations', navLabel: 'Reservations', authTier: 'public', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Menu', path: '/menu', icon: 'RestaurantMenu', authTier: 'public' },
      { title: 'Reservations', path: '/reservations', icon: 'EventSeat', authTier: 'public' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'Restaurant',
    xsdStandard: 'UBL, GS1',
  },

  // 3. Hotel & Hospitality
  hotel: {
    id: 'hotel',
    label: 'Hotel & Hospitality',
    description: 'Hotel operations: room occupancy, RevPAR, F&B outlets, event spaces, booking management.',
    icon: 'Hotel',
    defaultColors: { primary: '#1565c0', secondary: '#ff8f00' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'rooms', title: 'Rooms', navLabel: 'Rooms', authTier: 'public', blockTypes: ['dynamic_form'] },
      { slug: 'bookings', title: 'Bookings', navLabel: 'Bookings', authTier: 'public', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Rooms', path: '/rooms', icon: 'Hotel', authTier: 'public' },
      { title: 'Bookings', path: '/bookings', icon: 'BookOnline', authTier: 'public' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: ['Hotel', 'LodgingBusiness'],
    xsdStandard: 'OTA (OpenTravel Alliance)',
  },

  // 4. E-Commerce & Retail
  'ecommerce-retail': {
    id: 'ecommerce-retail',
    label: 'E-Commerce & Retail',
    description: 'Online store operations: product catalog, inventory management, sales orders, customer management.',
    icon: 'ShoppingCart',
    defaultColors: { primary: '#7b1fa2', secondary: '#00bcd4' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'products', title: 'Products', navLabel: 'Products', authTier: 'public', blockTypes: ['dynamic_form'] },
      { slug: 'orders', title: 'Orders', navLabel: 'Orders', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Products', path: '/products', icon: 'Inventory', authTier: 'public' },
      { title: 'Orders', path: '/orders', icon: 'Receipt', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: ['Store', 'Product'],
    xsdStandard: 'UBL (orders), Inventory Feeds',
  },

  // 5. Healthcare & Clinical
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare & Clinical',
    description: 'Healthcare operations: patient records, clinical documents, insurance claims, medical device telemetry.',
    icon: 'LocalHospital',
    defaultColors: { primary: '#0097a7', secondary: '#ff6f00' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'patients', title: 'Patients', navLabel: 'Patients', authTier: 'pin', blockTypes: ['dynamic_form'] },
      { slug: 'claims', title: 'Insurance Claims', navLabel: 'Claims', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Patients', path: '/patients', icon: 'Person', authTier: 'pin' },
      { title: 'Claims', path: '/claims', icon: 'Assignment', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: ['MedicalOrganization', 'Hospital'],
    xsdStandard: 'HL7/CDA, Claims Processing',
  },

  // 6. Supply Chain & Logistics
  'supply-chain': {
    id: 'supply-chain',
    label: 'Supply Chain & Logistics',
    description: 'Logistics operations: shipment tracking, warehouse management, carrier coordination, freight manifests.',
    icon: 'LocalShipping',
    defaultColors: { primary: '#37474f', secondary: '#ff9800' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'shipments', title: 'Shipments', navLabel: 'Shipments', authTier: 'pin', blockTypes: ['dynamic_form'] },
      { slug: 'warehouse', title: 'Warehouse', navLabel: 'Warehouse', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Shipments', path: '/shipments', icon: 'LocalShipping', authTier: 'pin' },
      { title: 'Warehouse', path: '/warehouse', icon: 'Warehouse', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: ['DeliveryEvent', 'ParcelDelivery'],
    xsdStandard: 'UBL (shipping), B2B Logistics',
  },

  // 7. Real Estate & Property
  'real-estate': {
    id: 'real-estate',
    label: 'Real Estate & Property',
    description: 'Property management: listings, tenant management, lease tracking, maintenance requests.',
    icon: 'Home',
    defaultColors: { primary: '#1b5e20', secondary: '#f57c00' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'properties', title: 'Properties', navLabel: 'Properties', authTier: 'public', blockTypes: ['dynamic_form'] },
      { slug: 'leases', title: 'Leases', navLabel: 'Leases', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Properties', path: '/properties', icon: 'Home', authTier: 'public' },
      { title: 'Leases', path: '/leases', icon: 'Description', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'RealEstateAgent',
    xsdStandard: 'RETS (Real Estate Transaction)',
  },

  // 8. Education & E-Learning
  education: {
    id: 'education',
    label: 'Education & E-Learning',
    description: 'Educational operations: course management, student enrollment, assignments, grading, progress tracking.',
    icon: 'School',
    defaultColors: { primary: '#0d47a1', secondary: '#ffc107' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'courses', title: 'Courses', navLabel: 'Courses', authTier: 'public', blockTypes: ['dynamic_form'] },
      { slug: 'enrollments', title: 'Enrollments', navLabel: 'Enrollments', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Courses', path: '/courses', icon: 'School', authTier: 'public' },
      { title: 'Enrollments', path: '/enrollments', icon: 'AssignmentInd', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'EducationalOrganization',
    xsdStandard: 'IMS Global (LTI, QTI)',
  },

  // 9. Professional Services
  'professional-services': {
    id: 'professional-services',
    label: 'Professional Services',
    description: 'Consultancy operations: project management, time tracking, invoicing, client deliverables.',
    icon: 'BusinessCenter',
    defaultColors: { primary: '#263238', secondary: '#00bcd4' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'projects', title: 'Projects', navLabel: 'Projects', authTier: 'pin', blockTypes: ['dynamic_form'] },
      { slug: 'invoices', title: 'Invoices', navLabel: 'Invoices', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Projects', path: '/projects', icon: 'Folder', authTier: 'pin' },
      { title: 'Invoices', path: '/invoices', icon: 'Receipt', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'ProfessionalService',
    xsdStandard: 'UBL (billing)',
  },

  // 10. Manufacturing & Industrial
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing & Industrial',
    description: 'Production operations: work orders, bill of materials, quality checks, inventory lots, production scheduling.',
    icon: 'PrecisionManufacturing',
    defaultColors: { primary: '#bf360c', secondary: '#ffab00' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial']),
      { slug: 'production', title: 'Production Orders', navLabel: 'Production', authTier: 'pin', blockTypes: ['dynamic_form'] },
      { slug: 'quality', title: 'Quality Control', navLabel: 'Quality', authTier: 'pin', blockTypes: ['dynamic_form'] },
      SUMMARY_PAGE,
      TASKS_PAGE,
      ADMIN_PAGE,
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Production', path: '/production', icon: 'PrecisionManufacturing', authTier: 'pin' },
      { title: 'Quality', path: '/quality', icon: 'Verified', authTier: 'pin' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
    schemaOrgType: 'Manufacturer',
    xsdStandard: 'B2MML (Business To Manufacturing)',
  },

  // Default (minimal — kept for backward compatibility)
  default: {
    id: 'default',
    label: 'Generic Dashboard',
    description: 'A basic business operations dashboard with financial overview, tasks, and AI chat.',
    icon: 'Dashboard',
    defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },
    defaultPages: [
      DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial', 'chat_panel']),
      SUMMARY_PAGE,
      TASKS_PAGE,
    ],
    defaultNavItems: BASIC_NAV,
    schemaOrgType: 'LocalBusiness',
    xsdStandard: 'schema.org',
  },
};

/** Get a template by ID, falling back to 'default'. */
export function getTemplate(id: string): TemplateDefinition {
  return TEMPLATE_CATALOG[id] ?? TEMPLATE_CATALOG.default;
}

/** List all available templates. */
export function listTemplates(): TemplateDefinition[] {
  return Object.values(TEMPLATE_CATALOG);
}

/** Check if a given slug is reserved (cannot be used as a tenant slug). */
const RESERVED_SLUGS = new Set(['api', 'admin', 'dashboard', 'login', 'tokenizmyapp', 'www', 'app', 'config']);

export function isSlugAvailable(slug: string): boolean {
  if (RESERVED_SLUGS.has(slug.toLowerCase())) return false;
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}
