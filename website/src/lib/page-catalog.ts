/**
 * Code-first page catalog — runtime SSoT at MVP.
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
  | 'reports_rollup';

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
  sections: PageSectionDefinition[];
}

export interface ReviewPartDefinition {
  partSlug: string;
  partKey: string;
  title: string;
  authTier: AuthTier;
}

/** Parts A–G from Red Ruby Business Review. */
export const REVIEW_PART_CATALOG: Record<string, ReviewPartDefinition> = {
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
          badge: 'June 2026 · 12-Month Plan',
          headline: 'Business Review',
          subtitle:
            'From +IDR 166M/month EBITDA toward IDR 7.5B+/year EBITDA by 2027.',
          minTier: 'public',
        },
      },
      {
        blockType: 'chart_financial',
        config: { variant: 'dashboard', scenario: 'conservative', minTier: 'public' },
      },
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

export function listNavPages(tier: AuthTier): PageDefinition[] {
  return Object.values(PAGE_CATALOG)
    .filter((p) => p.showInNav !== false)
    .filter((p) => tierAllowsAccess(tier, p.authTier))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function resolvePage(slug: string): PageDefinition | null {
  return PAGE_CATALOG[slug] ?? null;
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
