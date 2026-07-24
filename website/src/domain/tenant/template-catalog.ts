/**
 * Template Catalog — defines available app templates with default configurations.
 *
 * Each template specifies default pages, navigation items, and brand presets
 * that get seeded when a tenant is created.
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
}

export const TEMPLATE_CATALOG: Record<string, TemplateDefinition> = {
  default: {
    id: 'default',
    label: 'Generic Dashboard',
    description: 'A basic business operations dashboard with financial overview, tasks, and AI chat.',
    icon: 'Dashboard',
    defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },
    defaultPages: [
      { slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial', 'chat_panel'] },
      { slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google', blockTypes: ['doc_markdown'] },
      { slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'] },
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
  },

  'nightclub-bar': {
    id: 'nightclub-bar',
    label: 'Nightclub & Bar',
    description: 'Full nightclub and bar operations: revenue streams, BEP analysis, promoter management, POS/Z-report, staff scheduling.',
    icon: 'Nightlife',
    defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },
    defaultPages: [
      { slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'] },
      { slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google', blockTypes: ['doc_markdown'] },
      { slug: 'review', title: 'Business Review', navLabel: 'Review', authTier: 'google', blockTypes: ['review_blocks'] },
      { slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'] },
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
  },

  restaurant: {
    id: 'restaurant',
    label: 'Restaurant',
    description: 'Restaurant operations: menu management, table reservations, daily covers, food cost analysis, GoFood integration.',
    icon: 'Restaurant',
    defaultColors: { primary: '#2e7d32', secondary: '#ff8f00' },
    defaultPages: [
      { slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'] },
      { slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google', blockTypes: ['doc_markdown'] },
      { slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'] },
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
  },

  hotel: {
    id: 'hotel',
    label: 'Hotel & Hospitality',
    description: 'Hotel operations: room occupancy, revenue per available room (RevPAR), F&B outlets, event spaces.',
    icon: 'Hotel',
    defaultColors: { primary: '#1565c0', secondary: '#ff8f00' },
    defaultPages: [
      { slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'] },
      { slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google', blockTypes: ['doc_markdown'] },
      { slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'] },
    ],
    defaultNavItems: [
      { title: 'Dashboard', path: '/dashboard', icon: 'Dashboard', authTier: 'public' },
      { title: 'Tasks', path: '/tasks', icon: 'CheckCircle', authTier: 'pin' },
      { title: 'Admin', path: '/admin', icon: 'Settings', authTier: 'pin' },
    ],
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
