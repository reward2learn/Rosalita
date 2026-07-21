/**
 * Code-first page catalog — runtime SSoT at MVP.
 * Supports static catalog entries and dynamically registered pages
 * (e.g. from workbook analysis after an Excel upload).
 *
 * DB AppPage/PageSection seeded in P6; catalog wins at runtime.
 */
export type AuthTier = 'public' | 'pin' | 'google';

export type BlockType =
  | 'hero'
  | 'metric_grid'
  | 'chart_financial'
  | 'lever_accordion'
  | 'action_checklist'
  | 'doc_markdown'
  | 'pnl_table'
  | 'ops_admin_tabs'
  | 'z_report_form'
  | 'costs_form'
  | 'calendar_import'
  | 'chat_panel'
  | 'review_blocks'
  | 'kpi_cards'
  | 'reports_rollup'
  | 'sheet_viewer';

export interface PageSectionDefinition {
  blockType: BlockType;
  config: Record<string, unknown>;
}

export interface PageDefinition {
  slug: string;
  title: string;
  authTier: AuthTier;
  navLabel?: string;
  showInNav?: boolean;
  pdfExport?: boolean;
  /** Security-group codes required to see this page in nav / access it (membership-based). */
  requiredGroups?: string[];
  sections: PageSectionDefinition[];
}

export interface ReviewPartDefinition {
  partSlug: string;
  partKey: string;
  title: string;
  authTier: AuthTier;
}

/** Parts from the uploaded Business Review — populated dynamically at render time. */

/** Static parts A–G exist for backward compatibility with legacy seeded docs. Dynamic parts override these. */
const STATIC_PARTS: Record<string, ReviewPartDefinition> = {
  'part-a': {
    partSlug: 'part-a',
    partKey: 'A',
    title: 'Part A: Current Situation — The Numbers',
    authTier: 'google',
  },
  'part-b': {
    partSlug: 'part-b',
    partKey: 'B',
    title: 'Part B: The 10-Year Growth Model',
    authTier: 'google',
  },
  'part-c': {
    partSlug: 'part-c',
    partKey: 'C',
    title: 'Part C: Revenue Optimization Strategy',
    authTier: 'google',
  },
  'part-d': {
    partSlug: 'part-d',
    partKey: 'D',
    title: 'Part D: Cost Management',
    authTier: 'google',
  },
  'part-e': {
    partSlug: 'part-e',
    partKey: 'E',
    title: 'Part E: Risk Register',
    authTier: 'google',
  },
  'part-f': {
    partSlug: 'part-f',
    partKey: 'F',
    title: 'Part F: StarWORLD Membership Program',
    authTier: 'google',
  },
  'part-g': {
    partSlug: 'part-g',
    partKey: 'G',
    title: 'Part G: Immediate Actions (Next 30 Days)',
    authTier: 'google',
  },
};

/** Dynamic parts populated from parsed Business Review MD uploaded via /config. */
let DYNAMIC_PARTS: Record<string, ReviewPartDefinition> = {};

export function setDynamicReviewParts(parts: ReviewPartDefinition[]): void {
  DYNAMIC_PARTS = Object.fromEntries(
    parts.map((p) => [p.partSlug, p]),
  );
}

export const REVIEW_PART_CATALOG: Record<string, ReviewPartDefinition> = {
  ...STATIC_PARTS,
  ...DYNAMIC_PARTS,
};

/** Dynamic pages registered at runtime (e.g. from workbook analysis after reseed). */
let DYNAMIC_PAGES: Record<string, PageDefinition> = {};

/**
 * Register dynamically generated pages — called after workbook analysis
 * during the reseed pipeline so sheet-derived analytics pages appear in the nav.
 */
export function setDynamicPages(pages: PageDefinition[]): void {
  DYNAMIC_PAGES = Object.fromEntries(pages.map((p) => [p.slug, p]));
}

/** Combined static + dynamic page catalog (evaluated lazily so dynamic pages are included). */
export function getFullCatalog(): Record<string, PageDefinition> {
  return { ...PAGE_CATALOG, ...DYNAMIC_PAGES };
}

export const PAGE_CATALOG: Record<string, PageDefinition> = {
  dashboard: {
    slug: 'dashboard',
    title: 'Dashboard',
    navLabel: 'Dashboard',
    showInNav: true,
    authTier: 'public',
    sections: [
      {
        blockType: 'hero',
        config: {
          badge: 'July 2026 · Exit Viability Review',
          headline: 'Business Review',
          subtitle:
            'Exit-viability assessment for PT Taman Bintang Bali — revenue under pressure, margin erosion detected, shareholder seeking pathway out.',
          minTier: 'public',
        },
      },
      // {
      //   blockType: 'chart_financial',
      //   config: { variant: 'dashboard', scenario: 'conservative', minTier: 'google' },
      // },
      {
        blockType: 'action_checklist',
        config: { minTier: 'pin' },
      },
      {
        blockType: 'metric_grid',
        config: { minTier: 'google' },
      },
      {
        blockType: 'lever_accordion',
        config: { title: 'The 5 Levers', minTier: 'google' },
      },
    ],
  },
  summary: {
    slug: 'summary',
    title: 'Executive Summary',
    navLabel: 'Summary',
    showInNav: true,
    authTier: 'google',
    pdfExport: true,
    sections: [{ blockType: 'doc_markdown', config: { source: 'executive-summary' } }],
  },
  'ops-admin': {
    slug: 'ops-admin',
    title: 'Ops Admin',
    navLabel: 'Ops Admin',
    showInNav: true,
    authTier: 'pin',
    requiredGroups: ['ops-admin'],
    sections: [{ blockType: 'ops_admin_tabs', config: {} }],
  },
  review: {
    slug: 'review',
    title: 'Business Review',
    navLabel: 'Review',
    showInNav: true,
    authTier: 'google',
    pdfExport: true,
    sections: [{ blockType: 'review_blocks', config: {} }],
  },
  'ops-tracking': {
    slug: 'ops-tracking',
    title: 'Financial Tracking',
    navLabel: 'Tracking',
    showInNav: true,
    authTier: 'google',
    sections: [
      { blockType: 'kpi_cards', config: { variant: 'ops' } },
      { blockType: 'reports_rollup', config: {} },
      { blockType: 'chart_financial', config: { variant: 'ops' } },
      { blockType: 'pnl_table', config: {} },
    ],
  },
  'ops-chat': {
    slug: 'ops-chat',
    title: 'AI Chat',
    navLabel: 'AI Chat',
    showInNav: true,
    authTier: 'google',
    sections: [{ blockType: 'chat_panel', config: {} }],
  },
  tasks: {
    slug: 'tasks',
    title: 'Exit-Viability Tasks',
    navLabel: 'Tasks',
    showInNav: true,
    authTier: 'google',
    sections: [],
  },
  admin: {
    slug: 'admin',
    title: 'Platform Admin',
    navLabel: 'Admin',
    showInNav: true,
    authTier: 'pin',
    sections: [],
  },
  'terms-of-service': {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    showInNav: false,
    authTier: 'public',
    sections: [{ blockType: 'doc_markdown', config: { source: 'terms-of-service.html' } }],
  },
  'privacy-policy': {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    showInNav: false,
    authTier: 'public',
    sections: [{ blockType: 'doc_markdown', config: { source: 'privacy-policy.html' } }],
  },
  'tax-structure': {
    slug: 'tax-structure',
    title: 'Tax Structure Notes',
    navLabel: 'Tax Notes',
    showInNav: true,
    authTier: 'public',
    sections: [{ blockType: 'doc_markdown', config: { source: 'part-o' } }],
  },
};

const TIER_RANK: Record<AuthTier, number> = {
  public: 0,
  pin: 1,
  google: 2,
};

export function tierAllowsAccess(current: AuthTier, required: AuthTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export function listNavPages(tier: AuthTier, groups: string[] = []): PageDefinition[] {
  return Object.values(getFullCatalog())
    .filter((p) => p.showInNav !== false)
    .filter((p) => tierAllowsAccess(tier, p.authTier))
    .filter((p) => !p.requiredGroups || p.requiredGroups.length === 0 || groups.includes('platform-admin') || p.requiredGroups.some((g) => groups.includes(g)))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function resolvePage(slug: string): PageDefinition | null {
  return getFullCatalog()[slug] ?? null;
}

export function resolveReviewPart(partSlug: string): ReviewPartDefinition | null {
  return REVIEW_PART_CATALOG[partSlug] ?? null;
}

export function listReviewParts(): ReviewPartDefinition[] {
  return Object.values(REVIEW_PART_CATALOG).sort((a, b) =>
    a.partKey.localeCompare(b.partKey),
  );
}

/** Descriptive title without the "Part X: " catalog prefix. */
export function getReviewPartDisplayTitle(title: string): string {
  return title.replace(/^Part [A-O]: /, '');
}
