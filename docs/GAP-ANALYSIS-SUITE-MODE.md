# Gap Analysis — Suite Mode Implementation

Generated: 2025-08-14  
Status: **P0 items complete. P1/P2 gaps identified below.**

---

## Executive Summary

The suite mode architecture is functional for **tenant lifecycle** (create/list/update/delete tenants with `templateMode=suite`). The dashboard UI shows app packs, per-app menus are wired to per-app API endpoints, and the materializer correctly generates `AppPackConfig` from prompts.

**What's working:**
- Tenant creation with suite mode → materializes `appPack.apps[]` into tenant metadata ✅
- Dashboard shows tenant + child apps (desktop table + mobile cards) ✅  
- Per-app actions (seed/migrate/deploy/check-status) wired to `/tenants/[slug]/apps/[appId]` ✅
- Add/remove apps from existing suite via `/tenants/[slug]/apps` ✅
- EditTenantModal shows suite composition in Template step ✅

**What's NOT working yet (gaps):**

| Gap | Severity | Description |
|-----|----------|-------------|
| **G1: Per-app provisioning pipeline doesn't exist** | 🔴 Critical | Creating a tenant with `templateMode=suite` materializes the app pack config but does NOT provision per-app Neon databases or Vercel projects. The Inngest workflow and `/provision` endpoint only work at the tenant level. |
| **G2: `tenants.template` column is misleading for suites** | 🟡 Medium | Suite tenants have `template='default'` (first template) in the column, but real templates live in `metadata.config.appPack.apps[].templateId`. Should be `'suite'` or null. |
| **G3: Tenant provisioning endpoint doesn't decompose suite apps** | 🔴 Critical | `/tenants/[slug]/provision` creates ONE Google OAuth project, ONE Neon DB branch, ONE Vercel deploy. Suite tenants need N app-level provisions. |
| **G4: Per-app API endpoints use raw SQL, not Prisma schema** | 🟡 Medium | The per-app route (`apps/[appId]/route.ts`) reads tenant metadata via raw SQL and updates it directly. It would be more robust to have a proper ZenStack model for app packs. |
| **G5: Dashboard tenants list doesn't show suite hierarchy visually** | 🟢 Low | Single-tenant rows are flat cards; the desktop table shows no grouping indicator for suites beyond the `isSuiteTenant` flag. |

---

## Detailed Gap Analysis

### G1: Per-app provisioning pipeline (CRITICAL)

**Problem:** When a tenant is created with `templateMode='suite'`, the POST `/api/admin/tenants` handler calls `materializeAppPackForTenant()` which stores `appPack.apps[]` in tenant metadata. But no code exists to:

1. Provision a Neon database branch per app
2. Create a Vercel project per app  
3. Set up Google OAuth credentials per app
4. Run migrations on each app's DB independently
5. Seed each app's pages/navigation/sections
6. Update each `SuiteAppInstance.status` from `'pending'` → `'deploying'` → `'live'`

**What exists today:**
- `materializeAppPackForTenant()` — generates the app pack config ✅
- `deploySuiteApps()` (in materializer) — loops through apps calling `deployTenant()` ✅ *(just added)*
- `/tenants/[slug]/apps/[appId]` per-app endpoints ✅ *(just added)*

**What's missing:**
There is **no bridge** between app pack generation and actual infrastructure provisioning. The current flow stops at: `suite tenant created → appPack.apps[] populated with status='pending'`. No code exists to take those `'pending'` apps through the provisioning pipeline.

**Remediation:** Create a new file `/src/domain/workflows/suite-provisioning.ts` that:
1. Reads the tenant's `appPack.config.appPack.apps[]` from metadata
2. For each app with status `'pending'`:
   - Calls `provisionTenantDatabase(appSlug)` where `appSlug = ${parentSlug}__${appId}`
   - Calls `deployTenant({ slug, template, ... })` for Vercel project per app
   - Calls `seedTenantDefaults()` per app (pages, nav, sections)
   - Updates `SuiteAppInstance.status` → `'live'`, stores `dbUrl`, `appUrl`, `vercelProjectId`

### G2: `tenants.template` column ambiguity (MEDIUM)

**Current behavior:** When creating a suite tenant, `template` is set to the first template ID from the `templates[]` array. This column is then read by code like:
```typescript
const tpl = getTemplate(tenant.template); // Gets wrong template for suites!
```

**Remediation:** In `POST /api/admin/tenants`, when `templateMode === 'suite'`:
```sql
UPDATE tenants SET 
  template = 'suite',  -- or NULL to indicate no single template
  updated_at = CURRENT_TIMESTAMP 
WHERE slug = $1;
```
Then update all code that reads `tenant.template` to check for `'suite'` first:
```typescript
const templateId = tenant.template === 'suite' 
  ? (appPack?.apps[0]?.templateId ?? 'default')
  : tenant.template;
```

### G3: Provision endpoint doesn't decompose suite apps (CRITICAL)

**Problem:** `POST /tenants/[slug]/provision` creates one Google Cloud OAuth project, provisions one Neon branch, triggers one Vercel deploy. For a suite with 5 apps, you need **5x each**.

**Remediation:** In `/api/admin/tenants/[slug]/provision`:
1. Check if tenant is in suite mode (read `metadata.config.appPack`)
2. If suite: loop through each app and provision per-app infrastructure
3. Store Google OAuth credentials as `metadata.googleOAuth.apps[{appId}]` (per-app)
4. Each app gets its own Neon branch name (e.g., `{parent}-appointments-booking`)
5. Emit per-app events via Inngest

### G4: Per-app API uses raw SQL for metadata updates (MEDIUM)

**Current state:** The per-app route uses:
```typescript
await db.$executeRawUnsafe(
  `UPDATE tenants SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{config,appPack}', $1::jsonb)...`
);
```

This works but is fragile — any schema change to `AppPackConfig` breaks the JSON path.

**Remediation:** Add a ZenStack model for `AppPack`:
```
model AppPack {
  id         String @id @default(cuid())
  tenant     Tenant @relation(fields: [tenantId], references: [id])
  packId     String
  name       String
  apps       Json   // SuiteAppInstance[]
  status     String
}
```

### G5: Dashboard visual hierarchy (LOW)

**Current:** Tenants list is flat — even suites are shown as one row. The suite indicator chip (`{n} apps`) helps but doesn't make the parent-child relationship visually clear.

**Remediation:** On desktop, render suite tenants with a grouped header:
```
▸ RedRuby Cantina (5 apps)   [Expanded by default]
  ├─ HR & Scheduling          [pending]
  ├─ POS System               [live] https://redruby-pos.vercel.app
  ├─ Finance Tracker          [live] ...
  ├─ Reviews & Analytics      [deploying]
  └─ CEO Overview             [live] ...
```

---

## Database Schema Audit

### Current `tenants` table columns (from tenant-service.ts):
| Column | Type | Purpose | Suite-aware? |
|--------|------|---------|--------------|
| `id` | TEXT | Primary key | ✅ |
| `slug` | TEXT | Unique identifier | ⚠️ Should be composite for suite apps |
| `display_name` | TEXT | Human name | ✅ |
| `template` | TEXT | Default template ID | ❌ Ambiguous for suites (see G2) |
| `status` | TEXT | draft/deploying/live/error | ⚠️ Only represents parent tenant, not apps |
| `vercel_project_id` | TEXT | Vercel project reference | ⚠️ Only parent tenant's project |
| `app_url` | TEXT | Deployment URL | ⚠️ Only parent tenant |
| `db_url` | TEXT | Neon DB connection | ⚠️ Only parent tenant |
| `primary_color` | TEXT | Brand color | ✅ |
| `secondary_color` | TEXT | Brand color | ✅ |
| `metadata` | JSONB | All config including appPack | ✅ (where suite data lives) |
| `created_by` | TEXT | Creator sub | ✅ |
| `api_key` | TEXT | License key | ✅ |

### Missing columns that should exist:
| Column | Type | Purpose | Why needed |
|--------|------|---------|------------|
| *(none at tenant level)* | — | Suite apps have their own infra | Each app's db_url, vercel_project_id, app_url lives inside `metadata.config.appPack.apps[]` instead of top-level columns. This is intentional to avoid DB schema changes. ✅ Acceptable trade-off. |

### Missing per-app infrastructure in SuiteAppInstance:
| Field | Current State | Needs? | Notes |
|-------|--------------|--------|-------|
| `status` | `'pending'` (hardcoded in materializer) | ❌ Already exists | Just needs provisioning to change it from `'pending'` |
| `dbUrl` | `null` | ❌ Already exists | Will be populated by provisioning |
| `vercelProjectId` | `null` | ❌ Already exists | Will be populated by provisioning |
| `appUrl` | `null` | ❌ Already exists | Will be populated by provisioning |
| `metadata` | `{models, pages, useCases, w3cStandard, schemaOrgType}` | ✅ Correctly seeded | Generated by app-pack generator |

---

## Endpoints Audit — Suite-awareness

### Endpoints that NEED per-app support (but don't have it yet):

| Endpoint | Current Behavior | Needs Change? |
|----------|-----------------|---------------|
| `POST /tenants` | Creates tenant + materializes appPack ✅ | ✅ Already correct — stores suite config in metadata |
| `GET /tenants/[slug]` | Returns tenant with `appPack` from metadata ✅ | ✅ Correct |
| `PUT /tenants/[slug]` | Updates tenant (including metadata) ✅ | ✅ Correct — can update appPack |
| `DELETE /tenants/[slug]` | **Soft deletes tenant** ⚠️ | 🔴 Should also cleanup per-app infra if suite |
| `POST /tenants/[slug]/provision` | One-shot provision for the whole tenant ❌ | 🔴 Must decompose for suites |
| `POST /tenants/[slug]/seed` | Seeds ONE template's pages/nav ✅ | ⚠️ Should accept optional `appId` for suite mode |
| `POST /tenants/[slug]/migrate` | Runs migrations on tenant DB ❌ | 🔴 Should run per-app if suite |
| `POST /tenants/[slug]/deploy` | Deploys ONE project ✅ | ⚠️ Should decompose for suites (or just return the app URLs) |

### New endpoints that DO have per-app support:

| Endpoint | Behavior | Status |
|----------|----------|--------|
| `GET /tenants/[slug]/apps/[appId]` | Get app status from appPack | ✅ Just added |
| `POST /tenants/[slug]/apps/[appId]` | Seed a specific app | ✅ Just added |
| `PUT /tenants/[slug]/apps/[appId]` | Deploy a specific app | ✅ Just added |
| `PATCH /tenants/[slug]/apps/[appId]` | Migrate/sync schema for an app | ✅ Just added |
| `POST /tenants/[slug]/apps` | Add app to suite | ✅ Just added |
| `DELETE /tenants/[slug]/apps` | Remove app from suite | ✅ Just added |

---

## What's Actually Missing Now (Summary)

### 🔴 Must-fix before production:

1. **Per-app provisioning pipeline** — When a suite tenant is created or when individual apps are seeded/deployed via the per-app endpoints, those apps need real infrastructure provisioned (Neon DB, Vercel project). Currently `deployTenant()` and `seedTenantDefaults()` exist but aren't wired into the per-app flow.

2. **Provision endpoint decomposition** — `/tenants/[slug]/provision` needs to detect suite mode and provision each app independently, not just the parent tenant.

3. **Inngest workflow update** — `provisionTenant` function needs a new variant: `provisionSuiteApps` that iterates through `appPack.apps[]` and provisions each one with its own Neon branch name, Vercel project, etc.

### 🟡 Should-fix:

4. Set `tenants.template = 'suite'` (not the first template ID) when in suite mode
5. Add ZenStack model for AppPack instead of raw JSON manipulation
6. Handle cascade deletion in DELETE /tenants/[slug] for suites

### 🟢 Nice-to-have:

7. Visual hierarchy in tenants list (grouped rows for suites)
8. Cross-app navigation links between suite apps
9. CEO Overview aggregation across app tables
