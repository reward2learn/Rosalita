# Reseller Onboarding Template

## Requirements

The Reseller Onboarding Template enables platform operators (e.g. Prestix.vip / Promohub) to rapidly onboard business partners, promoters, venues, or affiliate resellers with pre-configured capabilities:

### Core Business Requirements
- **Multi-tenant reseller isolation**: Each reseller gets dedicated slug, branding, dashboard, commission tracking
- **Partner network management**: Dashboard for tracking promoter performance, commission splits (PTIX auto-exchange mentioned in skills)
- **Automated onboarding flow**: Scraping from socials/websites, AI-generated prompt, template application, Vercel deploy
- **Revenue sharing**: Built-in commission tracking (venue 60/40 or configurable), payout reports
- **Event & Booking integration**: For hospitality (Rosalita Cantina context), link to reservations, menu, events
- **Schema.org alignment**: `Organization`, `Reseller`, `OfferCatalog`, `Event` types for SEO/structured data
- **Webhook integration**: `reseller.onboarded`, `commission.paid`, `partner.performance.updated`
- **Reusable component library**: Template Selector, Delta Preview, Onboarding Wizard that can be embedded in any business template

### Technical Requirements
- Follows all RedRuby-FPA / Prestix migration constraints (MUI v9, RTK Query + uiSlice, ZenStack, no Tailwind, dynamic-page/block-registry patterns)
- Incremental delta application (pages, nav, colors, blocks, seeded AppPage records)
- Integration with existing `TEMPLATE_CATALOG`, `template-selector.tsx`, webhook system
- Scraping integration for quick setup from Instagram/ website
- Production-ready error handling, loading states, type safety

## Architecture

### Template Definition (to be added to `website/src/domain/tenant/template-catalog.ts`)
```ts
reseller-onboarding: {
  id: 'reseller-onboarding',
  label: 'Reseller / Partner Onboarding',
  description: 'Dedicated partner dashboard for promoters, venues, affiliates. Commission tracking, performance analytics, automated onboarding, PTIX integration.',
  icon: 'GroupAdd',
  defaultColors: { primary: '#7c3aed', secondary: '#22d3ee' }, // Purple/teal theme
  defaultPages: [
    DASHBOARD_PAGE(['hero', 'kpi_cards', 'chart_financial', 'partner_metrics']),
    { slug: 'resellers', title: 'My Network', navLabel: 'Resellers', authTier: 'pin', blockTypes: ['dynamic_form', 'metric_grid'] },
    { slug: 'commissions', title: 'Commissions & Payouts', navLabel: 'Commissions', authTier: 'pin', blockTypes: ['pnl_table', 'action_checklist'] },
    { slug: 'onboarding', title: 'Onboard New Partner', navLabel: 'Onboard', authTier: 'pin', blockTypes: ['template-selector', 'scrape-form'] },
    SUMMARY_PAGE,
    TASKS_PAGE,
    ADMIN_PAGE,
  ],
  defaultNavItems: [ /* ... with Partner, Commissions, Onboarding */ ],
  schemaOrgType: ['Organization', 'Reseller'],
  xsdStandard: 'UBL, PartnerML',
}
```

**Delta Logic**: Compares against previous template to add only net-new blocks/pages (e.g. `partner_metrics` block, commission models if additive).

### Components (Reusable Library)
The Template Selector is the cornerstone. Additional components in the library:

1. **TemplateSelector** (`ops-admin/template-selector.tsx`) — Main deliverable
2. **DeltaPreviewPanel** — Side-by-side or tabbed view of changes (pages added, nav diffs, color swatches, schema.org preview)
3. **ScrapingOrchestrator** — Integrates with `/api/admin/tenants/scrape`, recommends template based on business type (restaurant → reseller if promoter detected)
4. **OnboardingWizard** — Multi-step for resellers (business info → template select → branding → deploy)
5. **PartnerMetricsBlock** — Reusable MUI block for performance KPIs, consistent with `kpi-cards-block.tsx`, `metric-grid-block.tsx`
6. **CommissionSplitVisualizer** — Chart + form following `pnl-table-block.tsx` patterns

All follow:
- Named exports, kebab-case files where appropriate
- MUI v9 (Card, Grid2 if available, Stack, Chip, Tooltip, etc.)
- Integration with `useUpdateTenantMutation`, `tenant-api.ts`
- `dynamic-page` pattern: blocks registered in block registry, rendered via `DynamicPage`
- `block-registry` consistency: each block has props interface, test if complex
- No `any`, strict TS, theme integration via `uiSlice`

### Implementation Plan

**Phase 1: Template Selector (Priority)**
- Create `website/src/components/ops-admin/template-selector.tsx`
- Integrate `listTemplates()`, `getTemplate()`
- Business-specific cards with schema.org badges (`FinancialService`, `Restaurant`, `Reseller`)
- Click handler computes delta using utility `computeTemplateDelta(current, selected)`
- Live preview pane: Mock dashboard with applied colors, sample nav, block previews (hero, kpi cards with reseller data)
- Scraping button → calls scrape API → auto-selects best template + fills form
- Preview deltas in expandable sections or tabs: "Pages (+3)", "Navigation", "Theme", "Blocks", "JSON-LD"

**Phase 2: Delta Engine & Seeding**
- Add `computeTemplateDelta` to `template-catalog.ts` or new `tenant-delta.ts`
- Extend seed script to support `--template=reseller-onboarding`
- Update `tenant-service.ts` and Inngest handler for `tenant.template.amended` with reseller-specific logic (create partner record, setup PTIX split)

**Phase 3: Reusable Library & Blocks**
- Extract common patterns into `src/components/ops-admin/` and `src/components/blocks/`
- Implement `partner-metrics-block.tsx`, register in dynamic page
- Add to `ops-admin-tabs.tsx` as new tab or section

**Phase 4: Webhook & Testing**
- Extend webhook system with reseller events
- Update test scenarios
- E2E test for full onboarding flow

**Phase 5: Documentation & Rollout**
- This document + webhook-system.md
- Update `template-amendment-workflow.md`
- Add to TenantWizard and tenant edit flows
- Deploy via Vercel with template catalog update

## Components Needed (Detailed Spec for TemplateSelector)

**Props Interface:**
```tsx
interface TemplateSelectorProps {
  currentTemplate?: string;
  onSelect: (templateId: string, delta: TemplateDelta) => void;
  showPreview?: boolean;
  showScraping?: boolean;
  variant?: 'cards' | 'wizard' | 'compact';
  className?: string;
}
```

**Features Implemented:**
- Responsive MUI Grid of cards (3-col on lg)
- Hover effects, selected state with CheckCircle
- Metadata badges: schemaOrgType chips, xsdStandard
- Color preview swatches matching `defaultColors`
- "Preview Delta" button opens drawer/pane with:
  - Added/Changed/Removed pages (with blockTypes)
  - Nav item diffs
  - Color contrast check (WCAG)
  - JSON-LD preview snippet
- Live Preview tab: iframe-like simulation or React components showing sample UI with selected theme (use ThemeProvider wrapper)
- Scraping integration: URL input + "Analyze & Recommend" button that uses existing scrape endpoint and recommends 'reseller-onboarding' for partner-like sites
- Integration hook: `useTemplateDelta(currentId, selectedId)` using RTK or local computation

**Usage Instructions:**
```tsx
// In ops-admin-tabs.tsx or edit-tenant-modal.tsx
import { TemplateSelector } from './template-selector';

<TemplateSelector 
  currentTemplate={tenant.template}
  onSelect={(id, delta) => {
    setSelectedTemplate(id);
    setPreviewDelta(delta);
    // Trigger updateTenant mutation on confirm
  }}
  showPreview={true}
  showScraping={true}
/>
```

**Live Preview Pane Implementation Notes:**
- Uses `ThemeProvider` with computed theme from colors
- Renders sample `DynamicPage` mock with blocks from selected template
- Tabs: "Desktop Preview" | "Mobile" | "Delta Summary" | "Schema.org"
- Consistent with `JsonLdScript.tsx` and `dynamic-page.tsx` patterns

## Test Scenarios for Reseller Onboarding Flow

1. **Happy Path Onboarding**
   - Scrape promoter Instagram → recommends reseller-onboarding
   - Select template → delta shows +3 pages (resellers, commissions, onboarding)
   - Colors update to purple/teal
   - Deploy triggers webhook `reseller.onboarded`

2. **Template Amendment**
   - Existing restaurant tenant → change to reseller-onboarding
   - Delta: adds partner dashboard, removes menu-specific blocks, adds commission tracking
   - Preserves financial_projections data

3. **Edge Cases**
   - Invalid scrape URL
   - Template with conflicting schemaOrgType
   - Deploy failure rollback using `previousTemplate` in metadata
   - High volume partner onboarding (10 simultaneous)

4. **Webhook Tests** (see webhook-system.md)
   - `reseller.onboarded` payload includes commissionConfig, ptixWallet, schemaOrg data

## Usage Instructions for Deliverables

1. **TemplateSelector Component**: Drop into any ops-admin context or wizard. See props above. Follows all project standards.

2. **Documentation**: 
   - `docs/webhook-system.md`: Reference for all webhook ops
   - This file: Blueprint for reseller features

3. **Test Updates**: The `test-webhook.ts` has been extended with reseller scenarios. Run as documented in webhook-system.md.

**Next Steps**: Implement delta utility, register new blocks (`partner-metrics-block.tsx` etc.), update seed script, extend Inngest for full orchestration. This creates a comprehensive, reusable library aligned with dynamic-page and block-registry patterns.

**Alignment**: Fully compatible with PTIX token system, smart-account-wallet skills, security-groups for partner access gating.
