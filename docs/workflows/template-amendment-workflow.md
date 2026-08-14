# Template Amendment & Deploy Workflow

## Overview
This workflow defines how changing a tenant's **template** in the tokenizmyapp /admin interface (or ops-admin) propagates new capabilities to the tenant application (e.g. redrubybali.vercel.app). It is based on the template selection UI (cards/dropdown from `TEMPLATE_CATALOG` showing business sectors, defaultPages, navItems, colors, schemaOrgType) and the prominent **Deploy** button that triggers the amendment pipeline.

It extends the initial provisioning flow (seen in `tenant-wizard.tsx` PIPELINE_STEPS) to support **amendments** (post-provisioning template changes) with incremental updates, safety gates, and rollback options. Real Inngest orchestration lives in the tokenizmyapp core; this website provides stubs, APIs, catalog, and components.

**Key Files Reviewed:**
- `src/domain/tenant/template-catalog.ts`: Defines 10+ templates (financial-analytics, restaurant, hotel, etc.) with `defaultPages`, `defaultNavItems`, colors, `schemaOrgType`, `xsdStandard`.
- `src/domain/tenant/tenant-service.ts`: Manages `tenants` DB table (`template`, `status`, `vercel_project_id`, colors, metadata).
- `src/domain/workflows/tenant-provisioning.ts`: Inngest stub (`tenant.created`); real workflow in orchestrator handles `tenant.template.amended`.
- `src/store/apis/tenant-api.ts`: `updateTenant` mutation (supports `template` change).
- `src/components/ops-admin/tenant-wizard.tsx`, `tenant-dashboard.tsx`, `tenant-info-tab.tsx`: UI for selection, listing, info.
- API routes: `/api/admin/tenants/[slug]`, `/api/admin/tenants/generate-schema`, seed/migrate endpoints.
- Related: `page-catalog.ts`, ZenStack `schema.zmodel` (SSoT with `@@map`), AI schema generator, codegen compilers.

**New Capabilities Example (redrubybali):**
- Switching to `restaurant` → adds `/menu`, `/reservations` pages with `dynamic_form` blocks, menu management models, nav items, GoFood integration hooks, specific KPI cards.
- Switching to `financial-analytics` → adds Business Review, Ops Tracking, Z-report form, financial chart blocks, projections models (preserves `data_type` + `scenario` columns).
- Updates: MUI theme colors, schema.org JSON-LD, RTK Query slices if new endpoints, page-catalog overrides, AI chat context.

## End-to-End Flow (Template Change → New Capabilities)

### 1. /admin Route Interaction (Admin UI)
- Platform Admin (PIN or Google tier) navigates to **/admin** → **Tenants** tab (or dedicated tenant edit view).
- Selects tenant (e.g. redrubybali) from list (shows current template via `getTemplate(tenant.template)`).
- **Template Selection UI** (based on images):
  - Grid of cards (like in wizard) or Select dropdown populated by `listTemplates()` / `TEMPLATE_CATALOG`.
  - Each card shows: label, description, icon, preview chips of `defaultPages`, schema.org type, XSD standard, color swatches.
  - On selection: auto-updates preview of new pages/nav, suggests colors from `defaultColors`, generates default prompt if needed.
  - Optional: Edit metadata/prompt for AI customization.
- **Deploy Button** (prominent, with BuildIcon or rocket): 
  - Validates change (if template differs from current).
  - Calls `useUpdateTenantMutation({ slug: 'redrubybali', template: 'restaurant', status: 'deploying' })` → PUT `/api/admin/tenants/redrubybali`.
  - On success: Triggers Inngest event (client-side or via API webhook).
  - Shows progress dialog with pipeline steps (similar to wizard success step).
- UI updates `tenants` status to `deploying`, shows loading spinners. Polls `useListTenantsQuery()` or uses RTK invalidation.

### 2. DB Updates
- `ensureTenantsTable()` ensures `tenants` table.
- Updates row: `template = 'new-template'`, `status = 'deploying'`, `updated_at`, optional `metadata` with amendment history (previous template, timestamp).
- Preserves existing data (no full wipe). Tenant-specific Neon DB connection via `db_url` or shared with branch.

### 3. Inngest Event Trigger
- Event: `tenant.template.amended` (or `tenant.deploy.triggered` with `amendment: true` flag).
- Payload: `{ slug: 'redrubybali', newTemplate: 'restaurant', previousTemplate: 'default', prompt?: string, forceFull?: boolean }`.
- Handled by orchestrator function (extends `provisionTenant` stub). Retries: 3. Concurrency control per slug.

### 4. Inngest Workflow Steps (Amendment-Optimized)
The workflow coordinates:

**Phase A: Analysis & Planning (idempotent)**
- Fetch tenant record + current schema state.
- Compare old vs new template (`getTemplate()`).
- Determine delta: new pages, new models/use-cases, nav changes, color updates.
- If `forceFull` or major delta (e.g. schema.org type change), run full reprovision path.
- Generate/update AI prompt combining tenant metadata, new template description, existing data summary.

**Phase B: AI Schema Generation**
- Call `/api/admin/tenants/generate-schema` or internal `generateSchemaFromPrompt(newPrompt, newTemplateId)`.
- AI (Vercel AI SDK / OpenAI) produces W3C-aligned schema (models, useCases, pages) tailored to template (e.g. `MenuItem`, `Reservation` models with `@@map("menu_items")`).
- `compileToZModel()` and `compileToPageCatalog()` produce:
  - Updated `schema.zmodel` snippet (appended/merged, introspection-first).
  - Updated `src/lib/page-catalog.ts` entries (DB `AppPage` seeded but catalog wins at runtime).
- Output: new ZenStack models for new capabilities (blocks like `z_report_form`, `sheet_viewer`).

**Phase C: Database Updates**
- Use tenant's Neon DB (via `createClient()` with tenant context or branch).
- Run ZenStack `migrate` or Prisma migrations for new tables/relations.
- **Critical:** Preserve `financial_projections.data_type` + `scenario` columns (as per constraints).
- Incremental seed for new domain defaults (e.g. sample menu items for restaurant template). Use `bun run seed -- --tenant=redrubybali`.
- Update any tenant-specific metadata tables.

**Phase D: Code Generation & Consistency**
- Regenerate/enable components based on new `defaultPages`/`blockTypes` (e.g. new dynamic forms, KPI cards specific to sector).
- Update `tenant-service`, theme (MUI v9 colors from template), navigation (from `defaultNavItems` with auth tiers: public/pin/google).
- Ensure state management (RTK Query for new APIs + `uiSlice` + `chatStreamSlice` + RHF; no Zustand).
- Update `page-catalog.ts` or DB `AppPage` for new slugs (dashboard always has financial charts, etc.).
- Technical consistency: All write APIs use JWT session claims (`requireWriteAuth`), Zod validation.

**Phase E: Deployment**
- Update Vercel project (if `vercel_project_id` set): env vars for new template, colors.
- Trigger Vercel Deployment via API (or Git push if configured).
- Set tenant `status = 'live'`, `app_url`.
- Post-deploy verification: health check, smoke test new pages.

**Phase F: Notification & Review**
- Emit `tenant.deployed` event.
- Update admin UI (refresh list, show success with new capabilities list).
- Log changes for audit (who changed template, what was added).
- Optional: AI Content Generation tab for Business Review/Executive Summary regeneration based on new template.

### 5. Post-Deploy in Tenant App (redrubybali)
- Runtime uses updated `page-catalog.ts` + DB `AppPage` (catalog wins).
- New pages rendered via dynamic blocks (MUI components matched to `blockTypes`).
- New DB models available via ZenStack queries/mutations.
- Updated dashboard shows template-specific KPIs, charts.
- Auth tiers enforced per page/nav item.
- Changes are live on Vercel (preview or production).

**Error Handling & Rollback:**
- On failure: set `status='error'`, notify via Inngest, rollback schema to previous version (stored in metadata or git).
- Dry-run mode available in admin (uses `mock=true` in generate-schema).
- Idempotent steps (e.g. `ensure*Table`).

**Constraints Honored:**
- Schema introspection-first with `@@map`.
- Preserve financial columns.
- JWT cookie sessions for writes (no x-admin-key in new routes).
- RTK Query + slices + RHF only.
- Code-first pages where possible.
- No modification of legacy api/*.js.

## Proposed Workflow Definition (for nomadworks.yaml or Orchestrator)

Add this to `.codenomad/workflows/` or as a new file. This can be implemented as Inngest steps or CodeNomad agent workflow.

```yaml
# nomadworks.yaml or docs/workflows/template-amendment-workflow.yaml
workflows:
  template-amendment:
    id: tenant.template.amended
    description: Handle template change in /admin → reprovision capabilities safely
    trigger: 
      - event: tenant.updated (if template changed)
      - button: Deploy in tenant admin UI
    actors:
      - platform-admin (via /admin)
      - website-migration-commander (orchestrator)
      - website-db (schema/codegen)
      - website-api (Inngest handlers)
      - website-ui (admin components)
      - website-deploy (Vercel)
    steps:
      1. /admin-interaction:
          actor: platform-admin
          ui: 
            - Select tenant
            - Template cards from template-catalog.ts (preview pages, colors, schemaOrg)
            - Edit prompt/metadata (optional)
            - Click "Update Template & Deploy" button (confirms delta)
          api: PUT /api/admin/tenants/{slug} {template: "...", status: "deploying"}
          output: Update tenants DB row, emit Inngest event
          validation: validateSlug, check template exists in TEMPLATE_CATALOG

      2. detect-amendment:
          actor: tenant-service
          action: Compare current vs new template using getTemplate()
          if delta:
            - store previous_template in metadata
            - set status=deploying
          output: amendmentPlan {newPages: [...], newModels: [...]}

      3. ai-schema-generation:
          actor: website-db + ai-content-generator
          action: generateSchemaFromPrompt(prompt, newTemplate) → compileToZModel + compileToPageCatalog
          tools: Vercel AI SDK, schema-generator.ts
          output: updated schema.zmodel snippet, page-catalog updates
          safety: mock mode, review generated models before apply

      4. db-migrations:
          actor: website-db
          action: ZenStack migrate on tenant Neon branch/DB
          constraints: 
            - @@map to existing tables
            - preserve financial_projections.data_type + scenario
            - incremental (ALTER not DROP)
          output: New domain models (e.g. reservations, menu_items)

      5. codegen-and-seed:
          actor: website-nextjs + website-ui + website-state
          actions:
            - Update page-catalog.ts or seed AppPage with new defaultPages
            - Regenerate/enable components for new blockTypes
            - Update nav, theme colors, RTK endpoints if needed
            - Run tenant-specific seed (menu.txt equivalent, sample data)
          constraints: No Zustand, use RTK Query + uiSlice + chatStreamSlice + RHF

      6. vercel-deploy:
          actor: website-deploy
          action: Trigger Vercel deploy for tenant project (using vercel_project_id)
          post: Update tenant status=live, app_url
          verification: Health check + test new pages

      7. review-and-notify:
          actor: ai-content-reviewer + platform-admin
          actions:
            - Regenerate Business Review/Executive Summary if template affects content
            - Notify tenant owner of new capabilities
            - Log in admin audit trail
          gates: Manual approval for production tenants

    rollback:
      - Revert template in DB
      - Restore previous schema.zmodel from metadata/git
      - Redeploy previous version

    metrics:
      - deployment_time
      - new_capabilities_added (page count delta)
      - error_rate

    coordinate_with: CTO (architectural patterns), Tech Lead (feasibility)
```

## Implementation Recommendations
1. Extend `tenant-provisioning.ts` with real `tenant.template.amended` handler that calls orchestrator services.
2. Add `useUpdateTenantMutation` to tenant-info-tab or new `TenantEditPanel` component with template selector + Deploy button.
3. Implement delta detection and incremental codegen to minimize downtime.
4. Add dry-run and preview mode in admin (shows what new pages/models will be added).
5. Integrate with existing AI Content Generation tab for post-amendment content refresh.
6. Update `PAGE_CATALOG` logic to merge template defaults with customizations.
7. Test with redrubybali: change to 'restaurant' → verify new menu/reservations pages appear after deploy.

This workflow ensures technical consistency, leverages the SSoT in template-catalog and schema.zmodel, and delivers new business capabilities rapidly via the admin Deploy button.

**Created:** Based on review of all listed components, APIs, and images of admin UI (template cards + deploy button).
**Owner:** Technical Architect
**Status:** Proposed — ready for implementation in P9+ optimization phase.
