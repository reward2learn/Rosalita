# WEBSITE (Tenant App Skeleton) — Implementation Handbook

**The Base Template for All AI-Generated Tenant Applications**

> This handbook is the living knowledge base for the `website/` directory —
> the skeleton that gets cloned, parametrized, and deployed for each tenant.
> Update it after each phase completion. Agents must read this before working on website.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State Audit](#2-current-state-audit)
3. [Role in the TOKENIZMYAPP Ecosystem](#3-role-in-the-tokenizmyapp-ecosystem)
4. [Implementation Roadmap](#4-implementation-roadmap)
5. [Code Instructions Per Phase](#5-code-instructions-per-phase)
6. [Knowledge Base & Progress Log](#6-knowledge-base--progress-log)
7. [File Inventory](#7-file-inventory)
8. [Constraints & Standards](#8-constraints--standards)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│  WEBSITE (Base Tenant App Skeleton)                           │
│                                                              │
│  ┌─ Next.js 16 App Router ──────────────────────────────┐   │
│  │  src/app/(app)/[slug]/page.tsx  → DynamicPage         │   │
│  │  src/app/api/*/route.ts         → API handlers        │   │
│  │  src/proxy.ts                   → Security + auth     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ ZenStack Schema (SSoT) ─────────────────────────────┐   │
│  │  zenstack/schema.zmodel  → Base models (shared)      │   │
│  │  zenstack/templates/*.zmodel → Template extensions   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ MUI v9 Component System ────────────────────────────┐   │
│  │  src/theme/theme-registry.tsx  → Brand theme injection│   │
│  │  src/components/blocks/*       → Block components     │   │
│  │  src/lib/block-registry.ts     → Block type → React   │   │
│  │  src/lib/page-catalog.ts       → Page definitions     │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ State (RTK Query — no Zustand) ─────────────────────┐   │
│  │  src/store/apis/*  → 11 RTK Query APIs               │   │
│  │  src/store/slices/ → uiSlice + chatStreamSlice       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ Auth (JWT Cookie) ──────────────────────────────────┐   │
│  │  src/lib/auth/  → Google OAuth + PIN + session       │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌─ JSON-LD (Phase 7) ──────────────────────────────────┐   │
│  │  schema.org structured data per page                 │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

### Core Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| Language | TypeScript strict |
| Schema/ORM | ZenStack v2 (`schema.zmodel` is SSoT) |
| UI | MUI v9 (no Tailwind, no shadcn/ui) |
| State | RTK Query + uiSlice + chatStreamSlice + React Hook Form |
| Auth | JWT cookie `redruby.session` (jose), Google OAuth, PIN tiers |
| Database | Neon Postgres via ZenStack `createClient` |
| Testing | Vitest + React Testing Library |
| Deploy | Vercel |

---

## 2. Current State Audit

### What Exists ✅

| Component | File | Status |
|-----------|------|--------|
| App Router | `src/app/(app)/[slug]/page.tsx` | ✅ Dynamic page rendering |
| Block Registry | `src/lib/block-registry.ts` | ⚠️ 16 blocks, financial only |
| Page Catalog | `src/lib/page-catalog.ts` | ⚠️ Hardcoded for financial-analytics |
| ZenStack Schema | `zenstack/schema.zmodel` | ⚠️ 25 models, financial-analytics only |
| MUI Theme | `src/theme/theme-registry.tsx` | ✅ Brand color injection |
| RTK Query | `src/store/` | ✅ 11 APIs + slices |
| JWT Auth | `src/lib/auth/` | ✅ Google + PIN |
| Proxy | `src/proxy.ts` | ✅ Security headers + JWT injection |
| AI Content | `src/domain/ai-content/` | ⚠️ Raw fetch() to OpenAI |
| Excel Parser | `src/domain/excel/` | ✅ Financial data extraction |
| PDF Export | `src/domain/pdf/` | ✅ Puppeteer server-side |
| POS/Z-Report | `src/domain/z-report/` | ✅ Financial analytics specific |
| Blocks | `src/components/blocks/` | 15 block components |

### Current Block Types (16)

| Block Type | Component | Sector |
|-----------|-----------|--------|
| `hero` | HeroBlock | Shared |
| `kpi_cards` | KpiCardsBlock | Shared |
| `metric_grid` | MetricGridBlock | Shared |
| `chart_financial` | ChartFinancialBlock | Financial |
| `lever_accordion` | LeverAccordionBlock | Financial |
| `action_checklist` | ActionChecklistBlock | Shared |
| `doc_markdown` | DocMarkdownBlock | Shared |
| `pnl_table` | PnlTableBlock | Financial |
| `ops_admin_tabs` | OpsAdminTabsBlock (stub) | Financial |
| `z_report_form` | ZReportFormBlock (stub) | Financial |
| `costs_form` | CostsFormBlock (stub) | Financial |
| `calendar_import` | CalendarImportBlock (stub) | Financial |
| `chat_panel` | ChatPanelBlock (stub) | Shared |
| `review_blocks` | ReviewBlocksBlock (stub) | Financial |
| `reports_rollup` | ReportsRollupBlock | Financial |
| `sheet_viewer` | SheetViewerBlock | Financial |

### What's Missing ❌

| Missing Component | Phase |
|-------------------|-------|
| Template-specific block components | Phase 5 |
| JSON-LD structured data | Phase 7 |
| Dynamic schema loading (per-tenant) | Phase 5 |
| Template-specific page catalog | Phase 5 |
| WASM validation integration | Phase 3 |
| AI SDK integration (replace raw fetch) | Phase 2 |
| Per-tenant ZenStack schema | Phase 5 |

---

## 3. Role in the TOKENIZMYAPP Ecosystem

```
TOKENIZMYAPP (Control Plane)
    │
    ├── 1. AI generates W3C schema from user prompt
    ├── 2. AI generates ZenStack .zmodel from schema
    ├── 3. AI generates page-catalog.ts from use cases
    ├── 4. AI generates block components from models
    ├── 5. AI generates API routes from use cases
    │
    ▼
WEBSITE (Base Skeleton)
    │
    ├── Gets cloned to /tmp/tenant-{slug}/
    ├── Schema replaced with AI-generated .zmodel
    ├── Page catalog replaced with AI-generated catalog
    ├── Block components added/extended
    ├── API routes added for template-specific CRUD
    ├── Tenant config injected (slug, colors, schema.org type)
    ├── Design tokens injected into MUI ThemeProvider
    │
    ▼
VERCEL CLI
    │
    ├── vercel link --project={slug}
    ├── vercel env add POSTGRES_URL, ENCRYPTION_KEY, etc.
    ├── vercel deploy --prod
    │
    ▼
LIVE TENANT APP at {slug}.vercel.app
```

### What the Skeleton Provides (Shared Across All Templates)

1. **App Router shell** — layout, proxy, auth, navigation
2. **MUI theme system** — brand color injection via `theme-registry.tsx`
3. **Block rendering engine** — `DynamicPage` resolves slug → blocks
4. **RTK Query state** — base API infrastructure
5. **JWT auth** — Google OAuth + PIN tiers
6. **Admin panel** — brand config, navigation, user management
7. **AI chat** — chat panel with SSE streaming
8. **PDF export** — Puppeteer server-side

### What Gets Generated Per Tenant

1. **ZenStack schema** — template-specific models (e.g., MenuItem for restaurant)
2. **Page catalog** — template-specific pages and blocks
3. **Block components** — template-specific UI blocks
4. **API routes** — template-specific CRUD endpoints
5. **JSON-LD** — schema.org structured data per template
6. **Design tokens** — brand colors, typography, spacing

---

## 4. Implementation Roadmap

### Phase 0: Foundation Correction (Week 1)
**Goal:** Reclassify templates, update block registry for shared vs template-specific.
**Noticeable Progress:** Template catalog reflects 10 real business sectors.

| Step | Task | Status |
|------|------|--------|
| 0.1 | Update `template-catalog.ts` (reclassify + 10 templates) | ⬜ Pending |
| 0.2 | Categorize blocks as shared vs template-specific | ⬜ Pending |
| 0.3 | Update `block-registry.ts` to support template-aware lookup | ⬜ Pending |

### Phase 1: MUI Pre-Compiled Component Registry (Week 2)
**Goal:** Integrate the shared MUI registry into the website block system.
**Noticeable Progress:** Dynamic forms render from schema definitions.

| Step | Task | Status |
|------|------|--------|
| 1.1 | Import shared component registry | ⬜ Pending |
| 1.2 | Create `DynamicFormBlock` for schema-driven forms | ⬜ Pending |
| 1.3 | Register `dynamic_form` block type | ⬜ Pending |
| 1.4 | Test with sample schema | ⬜ Pending |

### Phase 2: AI Schema Generation Integration (Week 3)
**Goal:** Website can receive AI-generated schemas and render them.
**Noticeable Progress:** AI-generated schema → working form in the browser.

| Step | Task | Status |
|------|------|--------|
| 2.1 | Create schema preview page in /admin | ⬜ Pending |
| 2.2 | Create schema rendering API endpoint | ⬜ Pending |
| 2.3 | Test end-to-end: prompt → schema → form | ⬜ Pending |

### Phase 3: WASM Validation Integration (Week 4)
**Goal:** Form validation runs via WASM in the browser.
**Noticeable Progress:** <1ms validation on form submit.

### Phase 5: Template-Specific Blocks & Pages (Week 6)
**Goal:** Each template has its own block components and page catalog.
**Noticeable Progress:** Restaurant template renders menu, reservations, covers.

### Phase 7: JSON-LD Schema.org Integration (Week 8)
**Goal:** Every page emits structured data.
**Noticeable Progress:** Google Rich Results test passes.

---

## 5. Code Instructions Per Phase

### Phase 0 Code

#### Step 0.1: Update template-catalog.ts

**File:** `website/src/domain/tenant/template-catalog.ts`

Same changes as tokenizmyapp — reclassify `nightclub-bar` → `financial-analytics`, add 10 templates.

#### Step 0.2: Categorize blocks

**File:** `website/src/lib/block-registry.ts` (updated)

```typescript
// SHARED blocks — available to all templates
export const SHARED_BLOCKS: Record<string, BlockComponent> = {
  hero: HeroBlock,
  kpi_cards: KpiCardsBlock,
  metric_grid: MetricGridBlock,
  action_checklist: ActionChecklistBlock,
  doc_markdown: DocMarkdownBlock,
  chat_panel: ChatPanelBlock,
};

// TEMPLATE-SPECIFIC blocks — only available to certain templates
export const TEMPLATE_BLOCKS: Record<string, Record<string, BlockComponent>> = {
  'financial-analytics': {
    chart_financial: ChartFinancialBlock,
    lever_accordion: LeverAccordionBlock,
    pnl_table: PnlTableBlock,
    ops_admin_tabs: OpsAdminTabsBlock,
    z_report_form: ZReportFormBlock,
    costs_form: CostsFormBlock,
    calendar_import: CalendarImportBlock,
    review_blocks: ReviewBlocksBlock,
    reports_rollup: ReportsRollupBlock,
    sheet_viewer: SheetViewerBlock,
  },
  // Future: restaurant, hotel, etc.
};

export function getBlockComponent(blockType: string, templateId?: string): BlockComponent {
  if (templateId && TEMPLATE_BLOCKS[templateId]?.[blockType]) {
    return TEMPLATE_BLOCKS[templateId][blockType];
  }
  return SHARED_BLOCKS[blockType] ?? StubBlock;
}
```

#### Step 0.3: Update DynamicPage to pass template ID

**File:** `website/src/app/(app)/[slug]/page.tsx`

```typescript
// When resolving blocks, pass the tenant's template ID
const templateId = tenantConfig.tenantTemplate;
const BlockComponent = getBlockComponent(section.blockType, templateId);
```

### Phase 1 Code

#### Step 1.1: Import shared registry

**File:** `website/src/components/blocks/dynamic-form-block.tsx`

```tsx
'use client';
import { DynamicForm } from '@tenants/shared/components/dynamic-form';
import type { SchemaModel } from '@tenants/shared/lib/schema/types';

export function DynamicFormBlock({ config }: { config: Record<string, unknown> }) {
  const model = config.model as SchemaModel;
  const handleSubmit = (values: Record<string, unknown>) => {
    console.log('Form submitted:', values);
    // TODO: POST to API route based on model.tableName
  };

  return (
    <DynamicForm
      model={model}
      onSubmit={handleSubmit}
      title={config.title as string ?? model.name}
    />
  );
}
```

#### Step 1.2: Register dynamic_form block

**File:** `website/src/lib/block-registry.ts`

```typescript
import { DynamicFormBlock } from '@/components/blocks/dynamic-form-block';

// Add to SHARED_BLOCKS
export const SHARED_BLOCKS: Record<string, BlockComponent> = {
  // ... existing
  dynamic_form: DynamicFormBlock,  // NEW
};
```

#### Step 1.3: Add 'dynamic_form' to BlockType enum

**File:** `website/zenstack/schema.zmodel`

```prisma
enum BlockType {
  // ... existing values
  dynamic_form  // NEW
}
```

**File:** `website/src/lib/page-catalog.ts`

```typescript
export type BlockType =
  | 'hero'
  | 'metric_grid'
  // ... existing
  | 'dynamic_form';  // NEW
```

### Phase 2 Code

#### Step 2.1: Schema preview page

**File:** `website/src/app/admin/schema-preview/page.tsx`

```tsx
'use client';
import { useState } from 'react';
import { Box, TextField, Button, Typography, Alert } from '@mui/material';
import { DynamicForm } from '@tenants/shared/components/dynamic-form';
import type { SchemaModel } from '@tenants/shared/lib/schema/types';

export default function SchemaPreviewPage() {
  const [prompt, setPrompt] = useState('');
  const [templateId, setTemplateId] = useState('restaurant');
  const [schema, setSchema] = useState<SchemaModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/tenants/generate-schema', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, templateId }),
      });
      const data = await res.json();
      if (data.success) {
        setSchema(data.data.schema.models[0]); // Preview first model
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    }
    setLoading(false);
  };

  return (
    <Box sx={{ p: 4 }}>
      <Typography variant="h4" gutterBottom>AI Schema Preview</Typography>
      <TextField
        fullWidth
        label="Describe your business"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="I run a restaurant in Bali with 20 tables..."
        multiline
        rows={3}
        sx={{ mb: 2 }}
      />
      <Button variant="contained" onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate Schema'}
      </Button>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      {schema && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h5" gutterBottom>{schema.name} Preview</Typography>
          <DynamicForm model={schema} onSubmit={(v) => console.log(v)} />
        </Box>
      )}
    </Box>
  );
}
```

---

## 6. Knowledge Base & Progress Log

> **Update this section after each phase completion.**

### Progress Log

| Date | Phase | Status | Agent | Notes |
|------|-------|--------|-------|-------|
| 2026-07-25 | Audit | ✅ Complete | Project Manager | Full architecture review |
| — | Phase 0 | ⬜ Pending | — | — |
| — | Phase 1 | ⬜ Pending | — | — |
| — | Phase 2 | ⬜ Pending | — | — |

### Key Decisions

1. **Block categorization:** 6 shared blocks + 10 financial-analytics-specific blocks (2026-07-25)
2. **DynamicFormBlock:** New block type `dynamic_form` renders any schema model as a form (planned)
3. **Schema preview page:** `/admin/schema-preview` for testing AI-generated schemas (planned)

### Lessons Learned

> Add entries as agents encounter and resolve issues.

---

## 7. File Inventory

### Existing Files (keep)

| File | Purpose |
|------|---------|
| `src/app/(app)/[slug]/page.tsx` | Dynamic page renderer |
| `src/lib/block-registry.ts` | Block type → component map |
| `src/lib/page-catalog.ts` | Page definitions (code-first SSoT) |
| `src/theme/theme-registry.tsx` | MUI theme with brand injection |
| `src/store/` | RTK Query + slices |
| `src/lib/auth/` | JWT auth |
| `src/proxy.ts` | Security headers + JWT injection |
| `src/domain/ai-content/` | AI content generation |
| `src/domain/excel/` | Excel parser |
| `src/domain/pdf/` | PDF export |
| `src/components/blocks/` | 15 block components |
| `zenstack/schema.zmodel` | ZenStack schema (25 models) |

### New Files (per phase)

| Phase | File | Purpose |
|-------|------|---------|
| 0 | `src/domain/tenant/template-catalog.ts` | Updated with 10 templates |
| 0 | `src/lib/block-registry.ts` | Updated with shared/template split |
| 1 | `src/components/blocks/dynamic-form-block.tsx` | Schema-driven form block |
| 2 | `src/app/admin/schema-preview/page.tsx` | AI schema preview page |
| 5 | `src/components/blocks/restaurant/*.tsx` | Restaurant-specific blocks |
| 5 | `src/components/blocks/hotel/*.tsx` | Hotel-specific blocks |
| 7 | `src/lib/seo/jsonld-generator.ts` | JSON-LD structured data |

---

## 8. Constraints & Standards

1. **website/ is the app directory** — all Next.js development here
2. **ZenStack schema.zmodel is SSoT** — introspection-first with `@@map`
3. **MUI v9 only** — no Tailwind, no shadcn/ui
4. **No Zustand** — RTK Query + uiSlice + chatStreamSlice + React Hook Form
5. **No `dotenv/config`** in `src/`
6. **No `x-admin-key`** — use JWT session claims
7. **Currency:** Full IDR integers in DB/API; K notation is UI-only
8. **PDF:** Server-side only (Puppeteer + @sparticuz/chromium)
9. **Legacy read-only:** Do not modify `api/*.js`, `lib/*.js`, or `*.html`
10. **Update this handbook** after each phase completion
11. **Shared blocks** are available to all templates
12. **Template-specific blocks** are only available to their template
13. **`dynamic_form` block** renders any schema model as a form via MUI registry

---

*Last updated: 2026-07-25*
*Next update: After Phase 0 completion*
