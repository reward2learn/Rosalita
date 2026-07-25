# TOKENIZMYAPP — Implementation Handbook

**Master Orchestrator for AI-Driven Tenant App Generation**

> This handbook is the living knowledge base for the TOKENIZMYAPP control plane.
> Update it after each phase completion. Agents must read this before working on tokenizmyapp.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Current State Audit](#2-current-state-audit)
3. [10 Business Sector Templates](#3-10-business-sector-templates)
4. [Implementation Roadmap (Phase 0–8)](#4-implementation-roadmap)
5. [Code Instructions Per Phase](#5-code-instructions-per-phase)
6. [Knowledge Base & Progress Log](#6-knowledge-base--progress-log)
7. [File Inventory](#7-file-inventory)
8. [Constraints & Standards](#8-constraints--standards)

---

## 1. Architecture Overview

```
                  ┌───────────────────────────────┐
                  │         User Prompt           │
                  │  "I run a restaurant in Bali" │
                  └───────────────┬───────────────┘
                                  │
                                  ▼
    ┌──────────────────────────────────────────────────────────┐
    │              TOKENIZMYAPP (Master Orchestrator)          │
    │                                                          │
    │  1. AI generates W3C JSON Schema (Vercel AI SDK)         │
    │     └─ generateObject → ZenStack .zmodel + use cases     │
    │                                                          │
    │  2. WASM validates schema in <1ms (Rust compiled)        │
    │                                                          │
    │  3. MUI Registry assembles UI blocks                     │
    │     └─ schema fields → pre-compiled MUI components       │
    │                                                          │
    │  4. Neon DB provisioned per tenant                       │
    │                                                          │
    │  5. Code generated (schema, blocks, APIs, pages)         │
    │                                                          │
    │  6. Vercel CLI deploys isolated tenant app               │
    │     └─ vercel link → env inject → vercel deploy --prod   │
    │                                                          │
    │  7. JSON-LD schema.org injected per page                │
    │                                                          │
    │  8. Inngest workflow orchestrates full pipeline          │
    └─────────────────────────────┬────────────────────────────┘
                                  │
                                  ▼
                  ┌───────────────────────────────┐
                  │       Vercel Ecosystem        │
                  │  Isolated Tenant Deployment   │
                  │  {slug}.vercel.app            │
                  └───────────────────────────────┘
```

### Core Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| Language | TypeScript strict |
| Schema/ORM | ZenStack v2 (schema.zmodel is SSoT) |
| UI | MUI v9 (pre-compiled component registry) |
| AI | Vercel AI SDK (`ai` + `@ai-sdk/openai`) via AI Gateway |
| Validation | WASM (Rust-compiled, microsecond schema validation) |
| Database | Neon Postgres (per-tenant branch provisioning) |
| Deploy | Vercel CLI (`child_process` execution) |
| Workflows | Inngest (durable multi-step tenant provisioning) |
| Auth | JWT cookie sessions (jose), Google OAuth, PIN tiers |

---

## 2. Current State Audit

### What Exists ✅

| Component | File | Status |
|-----------|------|--------|
| Tenant CRUD API | `src/app/api/admin/tenants/route.ts` | ✅ Creates, seeds, deploys |
| Vercel Deploy Service | `src/domain/tenant/vercel-deploy-service.ts` | ✅ Vercel API-based |
| Tenant Seed Service | `src/domain/tenant/tenant-seed-service.ts` | ✅ Pages, nav, groups |
| Template Catalog | `src/domain/tenant/template-catalog.ts` | ⚠️ 4 templates, stubs |
| ZenStack Schema | `zenstack/schema.zmodel` | ⚠️ 25 models, financial-analytics only |
| Block Registry | `src/lib/block-registry.ts` | ⚠️ 16 blocks, financial only |
| AI Content Gen | `src/domain/ai-content/` | ⚠️ Raw fetch() to OpenAI |
| RTK Query State | `src/store/` | ✅ 11 APIs + slices |
| JWT Auth | `src/lib/auth/` | ✅ Google + PIN |
| Shared Package | `packages/shared/` | ⚠️ Only 4 files |

### What's Missing ❌

| Missing Component | Phase |
|-------------------|-------|
| Neon DB provisioning | Phase 4 |
| AI-driven schema generation (`generateObject`) | Phase 2 |
| WASM validation engine | Phase 3 |
| Code generation service | Phase 6 |
| Vercel CLI execution (`child_process`) | Phase 6 |
| Workflow engine (Inngest) | Phase 8 |
| JSON-LD structured data | Phase 7 |
| Template-specific blocks/models | Phase 5 |
| MUI pre-compiled registry | Phase 1 |

---

## 3. 10 Business Sector Templates

Derived from W3C XML Schema (XSD) standards and schema.org types:

| # | Template ID | Sector | W3C/XSD Standard | schema.org Type |
|---|-------------|--------|-------------------|-----------------|
| 1 | `financial-analytics` | Financial performance tracking | FpML, FIXML | `FinancialService` |
| 2 | `restaurant` | Restaurant & food service | UBL, GS1 | `Restaurant` |
| 3 | `hotel` | Hotel & hospitality | OTA | `Hotel`, `LodgingBusiness` |
| 4 | `ecommerce-retail` | E-commerce & retail | UBL (orders) | `Store`, `Product` |
| 5 | `healthcare` | Healthcare & clinical | HL7/CDA | `MedicalOrganization` |
| 6 | `supply-chain` | Supply chain & logistics | UBL (shipping) | `DeliveryEvent` |
| 7 | `real-estate` | Real estate & property | RETS | `RealEstateAgent` |
| 8 | `education` | Education & e-learning | IMS Global | `EducationalOrganization` |
| 9 | `professional-services` | Professional services | UBL (billing) | `ProfessionalService` |
| 10 | `manufacturing` | Manufacturing & industrial | B2MML | `Manufacturer` |

### Template Correction

The previous `nightclub-bar` template was **misclassified**. Its 6 pages (dashboard, summary, review, tasks, ops-admin, ops-tracking) with blocks like `chart_financial`, `pnl_table`, `lever_accordion` are **financial analytical performance tracking** — not nightclub operations. It has been reclassified as `financial-analytics`.

---

## 4. Implementation Roadmap

### Phase 0: Foundation Correction (Week 1)
**Goal:** Reclassify templates, restructure shared package, define W3C schema types.
**Noticeable Progress:** 10 real templates in catalog; shared package restructured.

| Step | Task | Status |
|------|------|--------|
| 0.1 | Reclassify `nightclub-bar` → `financial-analytics` | ⬜ Pending |
| 0.2 | Add 10 business sector templates to catalog | ⬜ Pending |
| 0.3 | Restructure `@tenants/shared` package | ⬜ Pending |
| 0.4 | Define W3C schema type system (`types.ts`) | ⬜ Pending |

### Phase 1: MUI Pre-Compiled Component Registry (Week 2)
**Goal:** Schema-to-MUI mapping dictionary for AI-driven UI assembly.
**Noticeable Progress:** Working registry renders any schema as a functional form.

| Step | Task | Status |
|------|------|--------|
| 1.1 | Create MUI primitive registry | ⬜ Pending |
| 1.2 | Build schema-to-component resolver | ⬜ Pending |
| 1.3 | Create design token injection system | ⬜ Pending |
| 1.4 | Build dynamic form assembler | ⬜ Pending |

### Phase 2: AI-Driven W3C Schema Generation (Week 3)
**Goal:** AI SDK `generateObject` generates ZenStack schemas from natural language.
**Noticeable Progress:** User types prompt → AI generates complete schema + use cases + pages.

| Step | Task | Status |
|------|------|--------|
| 2.1 | Install AI SDK in tokenizmyapp | ⬜ Pending |
| 2.2 | Create schema generation Zod schema | ⬜ Pending |
| 2.3 | Create `generateSchemaFromPrompt()` | ⬜ Pending |
| 2.4 | Create schema → `.zmodel` compiler | ⬜ Pending |
| 2.5 | Create schema generation API route | ⬜ Pending |

### Phase 3: WASM Validation Engine (Week 4)
**Goal:** Rust-compiled WASM validates schemas in <1ms.
**Noticeable Progress:** Schema validation runs in microseconds via WASM.

### Phase 4: Neon Database Provisioning (Week 5)
**Goal:** Per-tenant isolated Neon database branches.
**Noticeable Progress:** Creating a tenant provisions a real isolated database.

### Phase 5: Template-Specific Schema Models (Week 6)
**Goal:** All 10 templates have complete W3C-aligned ZenStack schemas.
**Noticeable Progress:** All sectors have complete definitions.

### Phase 6: Code Generation & Vercel CLI Deployment (Week 7)
**Goal:** Generate per-tenant code and deploy via Vercel CLI.
**Noticeable Progress:** Tenant → live app URL.

### Phase 7: JSON-LD Schema.org Integration (Week 8)
**Goal:** Every page emits W3C structured data.
**Noticeable Progress:** Google Rich Results test passes.

### Phase 8: Workflow Engine (Week 9)
**Goal:** Durable multi-step tenant provisioning via Inngest.
**Noticeable Progress:** Tenant creation runs as monitored workflow.

---

## 5. Code Instructions Per Phase

### Phase 0 Code

#### Step 0.1: Reclassify template-catalog.ts

**File:** `tokenizmyapp/src/domain/tenant/template-catalog.ts`

```typescript
// REMOVE the 'nightclub-bar' entry
// ADD 'financial-analytics' with the same pages/blocks but new label/description

'financial-analytics': {
  id: 'financial-analytics',
  label: 'Financial Analytics',
  description: 'Financial performance tracking: revenue analysis, BEP modeling, P&L projections, KPI monitoring, executive reporting.',
  icon: 'Analytics',
  defaultColors: { primary: '#eb3d28', secondary: '#0af9fe' },
  defaultPages: [
    // Same pages as former nightclub-bar
    { slug: 'dashboard', title: 'Dashboard', navLabel: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'] },
    { slug: 'summary', title: 'Executive Summary', navLabel: 'Summary', authTier: 'google', blockTypes: ['doc_markdown'] },
    { slug: 'review', title: 'Business Review', navLabel: 'Review', authTier: 'google', blockTypes: ['review_blocks'] },
    { slug: 'tasks', title: 'Tasks', navLabel: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'] },
    { slug: 'ops-admin', title: 'Ops Admin', navLabel: 'Ops Admin', authTier: 'pin', blockTypes: ['ops_admin_tabs', 'z_report_form', 'costs_form'] },
    { slug: 'ops-tracking', title: 'Ops Tracking', navLabel: 'Ops Tracking', authTier: 'pin', blockTypes: ['kpi_cards', 'sheet_viewer'] },
  ],
  defaultNavItems: [
    // Same nav items
  ],
  // NEW fields:
  schemaOrgType: 'FinancialService',
  xsdStandard: 'FpML, FIXML',
},
```

#### Step 0.2: Add 10 templates

Add stub entries for all 10 business sectors. Each stub has:
- `id`, `label`, `description`, `icon`
- `schemaOrgType`, `xsdStandard`
- Basic pages (dashboard, summary, tasks)
- Basic nav items

#### Step 0.3: Restructure @tenants/shared

```
packages/shared/src/
  ├─ lib/
  │   ├─ config/tenant.ts          (existing — keep)
  │   └─ schema/                    (NEW)
  │       ├─ types.ts               (W3C schema type definitions)
  │       ├─ registry.ts            (template schema registry)
  │       └─ templates/             (per-template definitions)
  │           ├─ financial-analytics.ts
  │           ├─ restaurant.ts
  │           ├─ hotel.ts
  │           ├─ ecommerce-retail.ts
  │           ├─ healthcare.ts
  │           ├─ supply-chain.ts
  │           ├─ real-estate.ts
  │           ├─ education.ts
  │           ├─ professional-services.ts
  │           └─ manufacturing.ts
  ├─ theme/theme.ts                 (existing — keep)
  ├─ store/                         (existing — keep)
  └─ components/                    (NEW — Phase 1)
      ├─ registry.ts                (MUI component registry)
      ├─ resolver.ts                (schema → component resolver)
      └─ primitives/                (base MUI blocks)
```

#### Step 0.4: W3C schema types

**File:** `packages/shared/src/lib/schema/types.ts`

```typescript
/** W3C schema field types aligned with XSD data types */
export type SchemaFieldType =
  | 'string' | 'text' | 'integer' | 'decimal' | 'boolean'
  | 'datetime' | 'date' | 'time' | 'enum' | 'json' | 'relation';

export interface SchemaField {
  name: string;
  type: SchemaFieldType;
  required?: boolean;
  unique?: boolean;
  default?: unknown;
  enumValues?: string[];
  relationTo?: string;
  relationType?: 'one-to-many' | 'many-to-one' | 'many-to-many';
  schemaOrgProperty?: string;
  label?: string;
  width?: 4 | 6 | 8 | 12;
}

export interface SchemaModel {
  name: string;
  tableName: string;
  fields: SchemaField[];
  schemaOrgMapping?: Record<string, string>;
}

export interface UseCaseDefinition {
  id: string;
  title: string;
  auth: 'public' | 'pin' | 'google';
  route: string;
  blockTypes: string[];
  models: string[];
}

export interface PageDefinition {
  slug: string;
  title: string;
  authTier: 'public' | 'pin' | 'google';
  blockTypes: string[];
  navLabel?: string;
}

export interface BlockDefinition {
  type: string;
  label: string;
  model?: string;
  configSchema?: Record<string, unknown>;
}

export interface W3CSchemaDefinition {
  templateId: string;
  label: string;
  description: string;
  schemaOrgType: string | string[];
  xsdStandard: string;
  models: SchemaModel[];
  useCases: UseCaseDefinition[];
  pages: PageDefinition[];
  blocks: BlockDefinition[];
  defaultColors: { primary: string; secondary: string };
}
```

### Phase 1 Code

#### Step 1.1: MUI primitive registry

**File:** `packages/shared/src/components/registry.ts`

```typescript
import { TextField, Checkbox, Select, RadioGroup, DatePicker, TimePicker,
         Autocomplete, DataGrid, Accordion, Box, Typography, Button } from '@mui/material';

export interface MUIComponentConfig {
  component: React.ComponentType<any>;
  props: Record<string, unknown>;
}

export const MUI_COMPONENT_REGISTRY: Record<string, MUIComponentConfig> = {
  'string:short':     { component: TextField, props: { variant: 'outlined' } },
  'string:long':      { component: TextField, props: { multiline: true, rows: 4 } },
  'string:email':     { component: TextField, props: { type: 'email' } },
  'string:url':       { component: TextField, props: { type: 'url' } },
  'integer':          { component: TextField, props: { type: 'number' } },
  'decimal:currency': { component: TextField, props: { type: 'number', InputProps: { startAdornment: 'IDR' } } },
  'decimal:percent':  { component: TextField, props: { type: 'number', InputProps: { endAdornment: '%' } } },
  'boolean':          { component: Checkbox, props: {} },
  'datetime':         { component: DatePicker, props: {} },
  'date':             { component: DatePicker, props: {} },
  'time':             { component: TimePicker, props: {} },
  'enum:select':      { component: Select, props: { options: 'dynamic' } },
  'enum:radio':       { component: RadioGroup, props: { options: 'dynamic' } },
  'relation:m2o':     { component: Autocomplete, props: { fetchOptions: 'dynamic' } },
  'relation:o2m':     { component: DataGrid, props: { columns: 'dynamic' } },
  'json:array':       { component: DataGrid, props: { columns: 'dynamic' } },
  'json:object':      { component: Accordion, props: {} },
};
```

#### Step 1.2: Schema-to-component resolver

**File:** `packages/shared/src/components/resolver.ts`

```typescript
import { MUI_COMPONENT_REGISTRY, MUIComponentConfig } from './registry';
import type { SchemaField } from '../lib/schema/types';

export function buildRegistryKey(field: SchemaField): string {
  if (field.type === 'string') {
    if (field.name === 'email' || field.schemaOrgProperty === 'email') return 'string:email';
    if (field.name === 'url' || field.schemaOrgProperty === 'url') return 'string:url';
    return 'string:short';
  }
  if (field.type === 'text') return 'string:long';
  if (field.type === 'integer') return 'integer';
  if (field.type === 'decimal') {
    if (field.name.includes('price') || field.name.includes('cost') || field.name.includes('revenue'))
      return 'decimal:currency';
    if (field.name.includes('rate') || field.name.includes('percent'))
      return 'decimal:percent';
    return 'decimal:currency';
  }
  if (field.type === 'boolean') return 'boolean';
  if (field.type === 'datetime') return 'datetime';
  if (field.type === 'date') return 'date';
  if (field.type === 'time') return 'time';
  if (field.type === 'enum') return 'enum:select';
  if (field.type === 'relation') {
    return field.relationType === 'one-to-many' ? 'relation:o2m' : 'relation:m2o';
  }
  if (field.type === 'json') {
    return field.name.includes('array') || field.default instanceof Array ? 'json:array' : 'json:object';
  }
  return 'string:short';
}

export function resolveComponent(field: SchemaField): MUIComponentConfig {
  const key = buildRegistryKey(field);
  return MUI_COMPONENT_REGISTRY[key] ?? MUI_COMPONENT_REGISTRY['string:short'];
}
```

#### Step 1.3: Design token system

**File:** `packages/shared/src/theme/design-tokens.ts`

```typescript
import { createTheme, type Theme } from '@mui/material/styles';

export interface DesignTokens {
  primaryColor: string;
  secondaryColor: string;
  borderRadius: number;
  spacingDensity: 'compact' | 'comfortable' | 'dense';
  typographyScale: 'small' | 'medium' | 'large';
  mode: 'dark' | 'light';
}

export const DEFAULT_TOKENS: DesignTokens = {
  primaryColor: '#eb3d28',
  secondaryColor: '#0af9fe',
  borderRadius: 16,
  spacingDensity: 'comfortable',
  typographyScale: 'medium',
  mode: 'dark',
};

export function buildThemeFromTokens(tokens: DesignTokens): Theme {
  const spacingFactor = tokens.spacingDensity === 'compact' ? 6 : tokens.spacingDensity === 'dense' ? 4 : 8;
  const fontSize = tokens.typographyScale === 'small' ? 14 : tokens.typographyScale === 'large' ? 18 : 16;

  return createTheme({
    palette: {
      mode: tokens.mode,
      primary: { main: tokens.primaryColor },
      secondary: { main: tokens.secondaryColor },
      ...(tokens.mode === 'dark'
        ? { background: { default: '#0f0f14', paper: '#1a1a22' }, text: { primary: '#f0f0f5', secondary: '#8888a0' } }
        : {}),
    },
    shape: { borderRadius: tokens.borderRadius },
    spacing: spacingFactor,
    typography: { fontSize },
  });
}
```

#### Step 1.4: Dynamic form assembler

**File:** `packages/shared/src/components/dynamic-form.tsx`

```tsx
'use client';
import React from 'react';
import { Grid2 as Grid, Box, Typography, Button } from '@mui/material';
import type { SchemaModel, SchemaField } from '../lib/schema/types';
import { resolveComponent } from './resolver';

export interface DynamicFormProps {
  model: SchemaModel;
  initialValues?: Record<string, unknown>;
  onSubmit: (values: Record<string, unknown>) => void;
  title?: string;
}

export function DynamicForm({ model, initialValues = {}, onSubmit, title }: DynamicFormProps) {
  const [values, setValues] = React.useState<Record<string, unknown>>(initialValues);

  const handleChange = (fieldName: string, value: unknown) => {
    setValues(prev => ({ ...prev, [fieldName]: value }));
  };

  return (
    <Box sx={{ p: 3 }}>
      {title && (
        <Typography variant="h4" gutterBottom color="primary">
          {title}
        </Typography>
      )}
      <Grid container spacing={3}>
        {model.fields.map((field: SchemaField) => {
          const config = resolveComponent(field);
          const Component = config.component;
          return (
            <Grid size={{ xs: 12, md: field.width ?? 12 }} key={field.name}>
              <Component
                {...config.props}
                label={field.label ?? field.name}
                name={field.name}
                required={field.required}
                value={values[field.name] ?? ''}
                onChange={(e: any) => handleChange(field.name, e.target?.value ?? e)}
              />
            </Grid>
          );
        })}
      </Grid>
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="contained" color="primary" size="large" onClick={() => onSubmit(values)}>
          Submit
        </Button>
      </Box>
    </Box>
  );
}
```

### Phase 2 Code

#### Step 2.1: Install AI SDK

```bash
cd tokenizmyapp && bun add ai @ai-sdk/openai
```

#### Step 2.2: Schema generation Zod schema

**File:** `tokenizmyapp/src/domain/ai/schema-generation-schema.ts`

```typescript
import { z } from 'zod';

export const schemaGenerationZodSchema = z.object({
  templateId: z.string(),
  schemaOrgType: z.string(),
  models: z.array(z.object({
    name: z.string(),
    tableName: z.string(),
    fields: z.array(z.object({
      name: z.string(),
      type: z.enum(['string', 'text', 'integer', 'decimal', 'boolean', 'datetime', 'date', 'time', 'enum', 'json', 'relation']),
      required: z.boolean().default(false),
      unique: z.boolean().optional(),
      default: z.unknown().optional(),
      enumValues: z.array(z.string()).optional(),
      relationTo: z.string().optional(),
      relationType: z.enum(['one-to-many', 'many-to-one', 'many-to-many']).optional(),
      schemaOrgProperty: z.string().optional(),
      label: z.string().optional(),
      width: z.union([z.literal(4), z.literal(6), z.literal(8), z.literal(12)]).optional(),
    })),
    schemaOrgMapping: z.record(z.string()).optional(),
  })),
  useCases: z.array(z.object({
    id: z.string(),
    title: z.string(),
    auth: z.enum(['public', 'pin', 'google']),
    route: z.string(),
    blockTypes: z.array(z.string()),
    models: z.array(z.string()),
  })),
  pages: z.array(z.object({
    slug: z.string(),
    title: z.string(),
    authTier: z.enum(['public', 'pin', 'google']),
    blockTypes: z.array(z.string()),
    navLabel: z.string().optional(),
  })),
});

export type SchemaGenerationResult = z.infer<typeof schemaGenerationZodSchema>;
```

#### Step 2.3: generateSchemaFromPrompt()

**File:** `tokenizmyapp/src/domain/ai/schema-generator.ts`

```typescript
import { generateObject } from 'ai';
import { openai } from '@ai-sdk/openai';
import { schemaGenerationZodSchema, type SchemaGenerationResult } from './schema-generation-schema';

const W3C_STANDARDS: Record<string, string> = {
  'financial-analytics': 'FpML (Financial Products Markup Language) and FIXML for financial messaging',
  'restaurant': 'UBL (Universal Business Language) for invoices/orders and GS1 for product data',
  'hotel': 'OTA (OpenTravel Alliance) for room bookings and availability',
  'ecommerce-retail': 'UBL for orders and Inventory Feeds for SKU management',
  'healthcare': 'HL7/CDA for electronic health records and claims processing',
  'supply-chain': 'UBL for shipping notices and B2B logistics manifests',
  'real-estate': 'RETS (Real Estate Transaction Standard) for property listings',
  'education': 'IMS Global (LTI, QTI) for learning tools and assessment',
  'professional-services': 'UBL for billing and project management data',
  'manufacturing': 'B2MML (Business To Manufacturing Markup Language)',
};

export async function generateSchemaFromPrompt(
  userPrompt: string,
  templateId: string,
): Promise<SchemaGenerationResult> {
  const w3cStandard = W3C_STANDARDS[templateId] ?? 'schema.org';
  const { object } = await generateObject({
    model: openai('gpt-5.5'),
    schema: schemaGenerationZodSchema,
    system: `You are a W3C schema architect and ZenStack ORM expert.
Generate a complete ZenStack-compatible schema definition for a ${templateId} business.

Rules:
1. Map fields to schema.org properties where applicable (use schemaOrgProperty)
2. Use W3C XSD standards: ${w3cStandard}
3. Every model MUST include: id (String @id @default(cuid())), tenantSlug (String? @map("tenant_slug")), createdAt, updatedAt
4. Do NOT include id, tenantSlug, createdAt, or updatedAt in the fields array — they are auto-added
5. Use decimal type for monetary values with schemaOrgProperty "offers.price"
6. Use enum type for status fields with meaningful enumValues
7. Generate 3-7 models depending on the business complexity
8. Generate use cases (UC-XXX-NN format) with appropriate auth tiers
9. Generate pages with blockTypes from: hero, kpi_cards, chart_financial, doc_markdown, action_checklist, metric_grid, lever_accordion, pnl_table, chat_panel, sheet_viewer, review_blocks, reports_rollup, ops_admin_tabs, z_report_form, costs_form, calendar_import
10. All table names should be snake_case plural (e.g., "menu_items", "table_reservations")`,
    prompt: userPrompt,
  });
  return object;
}
```

#### Step 2.4: Schema → .zmodel compiler

**File:** `tokenizmyapp/src/domain/ai/zmodel-compiler.ts`

```typescript
import type { SchemaGenerationResult } from './schema-generation-schema';

function mapFieldType(field: SchemaGenerationResult['models'][0]['fields'][0]): string {
  switch (field.type) {
    case 'string': return 'String';
    case 'text': return 'String @db.Text';
    case 'integer': return 'Int';
    case 'decimal': return 'Decimal @db.Decimal(14, 2)';
    case 'boolean': return 'Boolean';
    case 'datetime': return 'DateTime';
    case 'date': return 'DateTime @db.Date';
    case 'time': return 'DateTime @db.Time';
    case 'enum': return 'String';
    case 'json': return 'Json';
    case 'relation': return 'String';
    default: return 'String';
  }
}

export function compileToZModel(schema: SchemaGenerationResult): string {
  const header = `// Auto-generated ZenStack schema for ${schema.templateId}
// Generated by TOKENIZMYAPP AI Schema Generator
// W3C Standard: ${schema.schemaOrgType}

datasource db {
  provider = "postgresql"
  url      = env("POSTGRES_URL")
}

generator client {
  provider = "prisma-client-js"
  output   = "../../src/generated/prisma"
  binaryTargets = ["native", "linux-arm64-openssl-3.0.x"]
}

enum AuthTier {
  public
  pin
  google
}
`;

  const models = schema.models.map(m => {
  const fields = m.fields.map(f => {
    const typeStr = mapFieldType(f);
    const optional = f.required ? '' : '?';
    const unique = f.unique ? ' @unique' : '';
    const defaultVal = f.default !== undefined ? ` @default(${JSON.stringify(f.default)})` : '';
    const comment = f.schemaOrgProperty ? `  /// schema.org:${f.schemaOrgProperty}` : '';
    const fieldLine = `  ${f.name} ${typeStr}${optional}${unique}${defaultVal}`;
    return comment ? `${comment}\n${fieldLine}` : fieldLine;
  }).join('\n');

  return `
model ${m.name} {
  id         String   @id @default(cuid())
  tenantSlug String?  @map("tenant_slug")
${fields}
  createdAt  DateTime @default(now()) @map("created_at")
  updatedAt  DateTime @updatedAt @map("updated_at")

  @@index([tenantSlug])
  @@map("${m.tableName}")
}`;
}).join('\n');

  return `${header}\n${models}\n`;
}
```

#### Step 2.5: Schema generation API route

**File:** `tokenizmyapp/src/app/api/admin/tenants/generate-schema/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { generateSchemaFromPrompt } from '@/domain/ai/schema-generator';
import { compileToZModel } from '@/domain/ai/zmodel-compiler';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: { prompt?: string; templateId?: string };
  try { body = await request.json(); } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!body.prompt || !body.templateId) {
    return jsonError('prompt and templateId are required', 400);
  }

  try {
    const schema = await generateSchemaFromPrompt(body.prompt, body.templateId);
    const zmodel = compileToZModel(schema);

    return jsonOk({
      schema,
      zmodel,
      modelCount: schema.models.length,
      useCaseCount: schema.useCases.length,
      pageCount: schema.pages.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-schema] Error:', msg);
    return jsonError(`Schema generation failed: ${msg.slice(0, 200)}`, 500);
  }
}
```

---

## 6. Knowledge Base & Progress Log

> **Update this section after each phase completion.**

### Progress Log

| Date | Phase | Status | Agent | Notes |
|------|-------|--------|-------|-------|
| 2026-07-25 | Audit | ✅ Complete | Project Manager | Full architecture review, 10 templates derived |
| — | Phase 0 | ⬜ Pending | — | — |
| — | Phase 1 | ⬜ Pending | — | — |
| — | Phase 2 | ⬜ Pending | — | — |

### Key Decisions

1. **Template reclassification:** `nightclub-bar` → `financial-analytics` (2026-07-25)
2. **10 business sectors** derived from W3C XSD standards (2026-07-25)
3. **AI SDK** chosen over raw `fetch()` for schema generation (planned)
4. **WASM** chosen for high-performance schema validation (planned)
5. **Neon per-tenant branches** for database isolation (planned)
6. **Vercel CLI** via `child_process` for deployment (planned)
7. **Inngest** for durable workflow orchestration (planned)

### Lessons Learned

> Add entries as agents encounter and resolve issues.

---

## 7. File Inventory

### Existing Files (keep)

| File | Purpose |
|------|---------|
| `src/app/api/admin/tenants/route.ts` | Tenant CRUD |
| `src/app/api/admin/tenants/[slug]/deploy/route.ts` | Vercel deploy |
| `src/app/api/admin/tenants/[slug]/migrate/route.ts` | DB migration |
| `src/app/api/admin/tenants/[slug]/seed/route.ts` | Tenant seed |
| `src/domain/tenant/vercel-deploy-service.ts` | Vercel API client |
| `src/domain/tenant/tenant-seed-service.ts` | Seed service |
| `src/domain/tenant/tenant-config-service.ts` | Config service |
| `src/domain/tenant/tenant-user-service.ts` | User service |
| `src/domain/tenant/template-catalog.ts` | Template catalog (to be updated) |
| `zenstack/schema.zmodel` | Current schema (to be templated) |

### New Files (per phase)

| Phase | File | Purpose |
|-------|------|---------|
| 0 | `packages/shared/src/lib/schema/types.ts` | W3C schema types |
| 0 | `packages/shared/src/lib/schema/registry.ts` | Template registry |
| 0 | `packages/shared/src/lib/schema/templates/*.ts` | 10 template definitions |
| 1 | `packages/shared/src/components/registry.ts` | MUI component registry |
| 1 | `packages/shared/src/components/resolver.ts` | Schema → MUI resolver |
| 1 | `packages/shared/src/theme/design-tokens.ts` | Design token system |
| 1 | `packages/shared/src/components/dynamic-form.tsx` | Dynamic form assembler |
| 2 | `src/domain/ai/schema-generation-schema.ts` | Zod schema for AI output |
| 2 | `src/domain/ai/schema-generator.ts` | AI schema generation |
| 2 | `src/domain/ai/zmodel-compiler.ts` | Schema → .zmodel compiler |
| 2 | `src/app/api/admin/tenants/generate-schema/route.ts` | API endpoint |
| 3 | `wasm/validator/` | Rust WASM validator |
| 4 | `src/domain/tenant/neon-provision-service.ts` | Neon DB provisioning |
| 6 | `src/domain/tenant/codegen-service.ts` | Code generation |
| 6 | `src/domain/tenant/vercel-cli-service.ts` | Vercel CLI execution |
| 8 | `src/lib/inngest.ts` | Inngest client |
| 8 | `src/domain/workflows/tenant-provisioning.ts` | Provisioning workflow |

---

## 8. Constraints & Standards

1. **Never modify** `CodeNomad/` source — it is the orchestrator tool
2. **website/ is the app directory** — all Next.js development happens inside `website/`
3. **ZenStack schema.zmodel is SSoT** — introspection-first with `@@map`
4. **No Zustand** — use RTK Query + slices + React Hook Form
5. **No `dotenv/config`** in `src/`
6. **No `x-admin-key`** — use JWT session claims
7. **Currency:** Full IDR integers in DB/API; K notation is UI-only
8. **AI Gateway:** Use `AI_GATEWAY_API_KEY` env var for all AI calls
9. **MUI v9 only** — no Tailwind, no shadcn/ui
10. **WASM modules** compiled from Rust with `wasm-pack --target web`
11. **Per-tenant isolation:** Neon branches, not shared schemas
12. **Update this handbook** after each phase completion

---

*Last updated: 2026-07-25*
*Next update: After Phase 0 completion*
