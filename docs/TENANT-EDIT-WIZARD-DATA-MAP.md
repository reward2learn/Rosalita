# Tenant Edit Wizard — Data Workflow Map

Generated: 2026-08-14
Scope: `tokenizmyapp/src/components/ops-admin/` — the tenant edit experience only (create wizard covered briefly for contrast). Companion to [`GAP-ANALYSIS-SUITE-MODE.md`](./GAP-ANALYSIS-SUITE-MODE.md), which covers infrastructure-provisioning gaps (G1–G5). This document covers **what data the edit wizard actually reads/writes, at what scope, and where the seams are.**

---

## 0. Which component is actually "the edit tenant wizard"?

There are **three** tenant form components in the codebase. Only one is live.

| Component | File | Status |
|---|---|---|
| `TenantWizard` | `tenant-wizard.tsx` | **Live** — but this is the *create*-tenant flow (5-step: Business Info → Template → AI Description → Branding → Review). Exports the shared `TemplateSelector` used by the edit modal. |
| `TenantEditor` | `tenant-editor.tsx` | **Dead code.** Zero imports anywhere in `src/`. A 3-tab dialog (General / License & API Key / Configuration) that appears to be an earlier, abandoned edit UI. Confirmed via `grep -rl "TenantEditor" src` returning no results outside its own file. |
| `EditTenantModal` | `edit-tenant-modal.tsx` | **Live — this is "the edit tenant wizard."** A 15-step non-linear `Stepper` dialog. Rendered from two different parent surfaces (see §4). The `"Select Template & Branding"` copy the user is looking at lives at [edit-tenant-modal.tsx:1168](../tokenizmyapp/src/components/ops-admin/edit-tenant-modal.tsx#L1168). |

**Recommendation:** delete `tenant-editor.tsx` in a follow-up cleanup pass — it's confirmed dead and will confuse anyone searching for "the edit wizard."

---

## 1. The 15 steps and exactly what each one stores

All steps write into a single JSON blob: `tenants.metadata.config` (jsonb column), via `useUpdateTenantMutation` (`PUT /api/admin/tenants/[slug]`). A few steps also write to dedicated columns (`display_name`, `template`, `primary_color`, `secondary_color`, `vercel_project_id`, `api_key`) or to separate tables/services entirely. Everything is **tenant-scoped** — there is no `appId` parameter anywhere in this wizard's save path.

| # | Step (label) | Fields captured | Persisted to | Scope |
|---|---|---|---|---|
| 0 | **Template** | `displayName`, `editTemplate`, `editPrimaryColor`, `editSecondaryColor` | `tenants.display_name`, `tenants.template`, `tenants.primary_color`, `tenants.secondary_color` | Tenant. In suite mode this step becomes **read-only** — it lists `appPack.apps[]` with an explicit warning: *"Template changes apply to the parent tenant only. Individual app templates can be modified by regenerating the suite or contacting support."* ([edit-tenant-modal.tsx:1223-1226](../tokenizmyapp/src/components/ops-admin/edit-tenant-modal.tsx#L1223)) |
| 1 | **Preview** | Favicon upload (`faviconData`/`faviconMimeType`) | `tenants.favicon_data` via `useUploadTenantFaviconMutation` (`POST /admin/tenants/[slug]/favicon`) — separate mutation, saved immediately on upload, not batched with "Save Changes" | Tenant. No preview of what an individual suite app would look like. |
| 2 | **Slug** | `newSlug` | `tenants.slug` (rename), via `useRenameTenantMutation` (`POST /admin/tenants/[slug]/rename`) — destructive, immediate, closes the modal | Tenant. Renaming a suite parent does **not** rename or relink the child apps' own `vercelProjectId`/`appUrl` (each suite app is its own Vercel project — see §3). |
| 3 | **License** | `licenseKey`, `licenseTier`, `validUntil` | `metadata.config.license.{key,tier,validUntil}` | Tenant-wide. One license covers every app in a suite. |
| 4 | **Features** | `features[]` (checkboxes), `setupToken`, `adminPin` | `metadata.config.license.features[]`, `metadata.config.apiKey` (+ `tenants.api_key` column), pin → `metadata.config.pins[0]` | Tenant-wide feature flags — a suite can't turn `ai-chat` on for one app and off for another. |
| 5 | **OpenAI API-Keys** | `openaiApiKey` | `metadata.config.openaiApiKey` | Tenant-wide — one key for every suite app's AI features. |
| 6 | **Google OAuth** | `clientId`, `clientSecret`, `projectId`, `authUri`, `redirectUris[]`, `gcpAccountEmail` (+ auto-provision via `useProvisionGoogleOAuthMutation`) | `metadata.config.googleAuth.*` | Tenant-wide. `redirectUris` are computed from the **tenant's** slug (`https://{tenant.slug}.vercel.app/...`) — never from a suite app's own `appUrl`, so OAuth callbacks for suite apps deployed to their own subdomain are not represented here at all. |
| 7 | **Database** | `dbUrl`/`pooledUrl`/`directUrl` (+ auto-provision via `useProvisionNeonMutation`, test via `useTestNeonConnectionMutation`) | `metadata.config.database.{databaseUrl,pooledUrl,directUrl}` | Tenant-wide. Each suite app has its own `dbUrl` field on `SuiteAppInstance` (`tenant-api.ts:37`) that this step never reads or writes. |
| 8 | **Custom Env** | `envPairs[]` (key/value) | `metadata.config.env` (object) | Tenant-wide — pushed to the tenant's single Vercel project on deploy. No per-app env var story. |
| 9 | **Deploy Hooks** | `deployHookUrl`, `vercelProjectId` | `metadata.config.hooks.deployHookUrl`, `tenants.vercel_project_id` (+ `metadata.config.vercelProjectId`) | Tenant-wide. Each suite app gets its *own* `vercelProjectId` on deploy ([apps/[appId]/route.ts:203-207](../tokenizmyapp/src/app/api/admin/tenants/%5Bslug%5D/apps/%5BappId%5D/route.ts#L203)) but there is **no field or UI anywhere** to store a per-app deploy hook URL — Flight Check's "Trigger Deploy Hook" test and the tenant three-dot menu's "Trigger Deploy Hook" action both only ever use `metadata.config.hooks.deployHookUrl` (the parent's). |
| 10 | **Functional Roles** | Role CRUD (`code`, `name`, `isPlatformAdmin`) + PIN-per-role | `roles` table via `useCreateRoleMutation`/`useUpdateRoleMutation`/`useDeleteRoleMutation`/`useSetRolePinMutation` | **This one is inconsistent with the rest of the wizard.** As of the tenant/app-scoping work landed earlier this session, `roles` rows *can* carry `tenantSlug`/`appId`, but this step's `useListRoleConfigsQuery()` call is unscoped — it lists every platform role globally, not just this tenant's. Roles created here are **not** stamped with `tenantSlug`/`appId` by this wizard at all (the `roleData` payload here never sets them; only `tenant-roles.tsx`, the *subtab* elsewhere in the admin panel, does). |
| 11 | **Custom Domain** | `customDomain`, fetch/set via `useSetTenantDomainMutation`/`useLazyGetTenantDomainsQuery` | Vercel API (domains attached to `tenant.vercelProjectId`) + `tenants.app_url` | Tenant only. No per-app domain UI, even though each suite app has its own `vercelProjectId` and could in principle have its own custom domain. |
| 12 | **Admin & Auth** | `adminEmail`, `pinSignInEnabled` | `metadata.config.adminEmail`, `metadata.config.auth.{adminEmail,pinSignInEnabled}` | Tenant-wide — one admin email/auth policy for every app in a suite. |
| 13 | **Flight Check** | Read-only validation + "Connection Tests" (webhook, deploy hook, Neon, redirect URIs, OpenAI) | Nothing persisted (except its "Auto-fix" buttons, which call back into `updateTenant` for specific fields) | Tenant only — validates the parent tenant's config; never validates an individual suite app's `dbUrl`/`vercelProjectId`/status. |
| 14 | **Summary** | Read-only rollup of steps 0–12 + Export/Import JSON | `handleExport`/`handleImport` (client-side file only, no persistence) | Tenant only. |

### The exact `metadata.config` shape this wizard produces on Save

```jsonc
// tenants.metadata (jsonb) — see buildDeployPayload() at edit-tenant-modal.tsx:687
// and handleSave() at edit-tenant-modal.tsx:739 (the two payloads differ slightly —
// see §2 "Save vs Deploy" below)
{
  "config": {
    "license": { "key": "...", "tier": "premium", "validUntil": "2028-12-31", "features": ["ai-chat", "..."] },
    "pins": ["454212"],
    "subscriptionTier": "premium",
    "apiKey": "st_...",
    "openaiApiKey": "sk-proj-...",
    "googleAuth": { "clientId": "...", "clientSecret": "...", "projectId": "...", "authUri": "...", "redirectUris": ["..."], "gcpAccountEmail": "..." },
    "database": { "databaseUrl": "...", "pooledUrl": "...", "directUrl": "..." },
    "env": { "MY_VAR": "value" },
    "hooks": { "deployHookUrl": "..." },
    "vercelProjectId": "prj_...",
    "adminEmail": "...",
    "auth": { "adminEmail": "...", "pinSignInEnabled": true },
    "appPack": { /* suite mode only — see §3, NEVER written by this wizard, only read */ }
  }
}
```

### Save vs. Deploy — two different write paths

- **"Save Changes"** → `handleSave()` ([edit-tenant-modal.tsx:739](../tokenizmyapp/src/components/ops-admin/edit-tenant-modal.tsx#L739)) → `updateTenant(payload).unwrap()` → `PUT /api/admin/tenants/[slug]` — writes the form state as-is, no Vercel calls, no schema regeneration.
- **"Deploy with Git"** (Summary step only) → `handleDeployWithGit()` → saves first, then either triggers the stored `deployHookUrl` or falls back to `POST /api/admin/tenants/[slug]/deploy` with `buildDeployPayload()` (a *slightly different* shape — includes `previousTemplate`, `amendmentReason: 'stepper-edit-and-deploy'`, and computes `pins` differently than `handleSave`'s payload does). This is a latent inconsistency: the two payload builders duplicate ~40 lines of nearly-identical-but-not-quite mapping logic.

---

## 2. Suite mode: what this wizard does and does not touch

`getAppPack(tenant)` ([edit-tenant-modal.tsx:257](../tokenizmyapp/src/components/ops-admin/edit-tenant-modal.tsx#L257)) reads `metadata.config.appPack` to detect suite mode. The wizard:

- **Reads** `appPack.apps[]` to render the read-only list in Step 0.
- **Never writes** to `appPack` anywhere in this file. Every one of the 15 steps' Save/Deploy handlers targets tenant-level fields only.
- Has **zero UI** for selecting "which app am I editing" — unlike the Redux-scoped admin panel (`tenant-admin-panel.tsx`), which has an app-selector and passes `appId` down to its 7 subtabs (Tenant Info, Navigation, Brand Config, Security Groups, Accounts, Roles, AI Chat). This wizard predates or simply doesn't participate in that appId-scoping work.

**Net effect:** for a suite tenant, every field in this 15-step wizard — license, features, OpenAI key, Google OAuth, database, env vars, deploy hook, roles, domain, admin/auth — is a single shared value that silently applies to *all* apps in the suite. There is no override mechanism. A suite where "App A" needs a different OpenAI key or a different admin email than "App B" cannot express that today.

---

## 3. `SuiteAppInstance` — the per-app data model this wizard ignores

Defined at [tenant-api.ts:30-41](../tokenizmyapp/src/store/apis/tenant-api.ts#L30):

```ts
interface SuiteAppInstance {
  appId: string;
  name: string;
  department: string;
  templateId: string;
  status: 'pending' | 'provisioning' | 'deploying' | 'live' | 'error';
  appUrl: string | null;
  dbUrl: string | null;
  vercelProjectId: string | null;
  metadata?: Record<string, unknown>; // schema/pages/useCases/w3cStandard from the app-pack generator
}
```

Each app already carries its **own** `dbUrl` and `vercelProjectId` — the data model supports per-app infrastructure. What's missing is:
- No `deployHookUrl` field (can't trigger a per-app deploy hook the way the tenant-level one works)
- No `customDomain`/domain list per app
- No `license`/`openaiApiKey`/`googleAuth`/`env` override fields per app
- No `adminEmail`/`auth` override per app

---

## 4. Where this wizard is actually opened from — and a bug found along the way

`EditTenantModal` is rendered from two places:

1. **`tenant-dashboard.tsx:1119`** — the "All Tenants" flat/table list (shown when no tenant is selected in the Redux-scoped panel, or standalone). Opened via `setEditor(t)` from a fully-wired three-dot menu per tenant row ([tenant-dashboard.tsx:886](../tokenizmyapp/src/components/ops-admin/tenant-dashboard.tsx#L886)).
2. **`tenant-admin-panel.tsx:367`** — rendered unconditionally once a tenant is selected, but **`editModalOpen` is never set to `true` anywhere in this file** (confirmed via `grep -n setEditModalOpen`). There is no Edit button, menu, or trigger of any kind in the Redux-scoped panel's tenant-selected view. **The edit wizard is currently unreachable from `tenant-admin-panel.tsx`.** This is a pre-existing gap, not something introduced by this session's tenant+app scoping work — flagged here since it's directly relevant to "streamlining the edit flow."

---

## 5. Two duplicate, diverging "Apps list" UI surfaces

| Surface | File | Per-app menu? | Actions available |
|---|---|---|---|
| Suite Apps (expandable row) | `tenant-dashboard.tsx:632-701` | ✅ Yes — `MoreVertIcon` → `Menu` | Seed This App, Sync DB Schema, Deploy This App, Check Status, Open App |
| Apps under this tenant | `tenant-admin-panel.tsx:241-292` | ❌ None | Click row to select (drives the Redux `adminSelectedAppId` used by the 7 subtabs) — no menu, no actions at all |

These are two independently-maintained renderings of the same `SuiteAppInstance[]` array, with different Chip styling, different click behavior, and only one of them has any actions. See the roadmap doc for the consolidation plan.

---

## 6. Existing per-app backend capability (already built, mostly unwired to UI)

`POST/GET/PUT/PATCH /api/admin/tenants/[slug]/apps/[appId]` ([route.ts](../tokenizmyapp/src/app/api/admin/tenants/%5Bslug%5D/apps/%5BappId%5D/route.ts)):

| Method | Action | Backing logic |
|---|---|---|
| `GET` | Check status | Reads `appPack.apps[]`, returns the matching entry |
| `POST` | Seed | `seedTenantDefaults()` + `seedTemplateSecurityGroups()`, called with a **synthetic slug** `${tenantSlug}__${appId}` — this is not a real row in the `tenants` table, it's just a scoping key used by the shared seed/pages/nav services |
| `PUT` | Deploy | `deployTenant()` from `vercel-deploy-service.ts`, called with the same synthetic slug — creates/updates a **real, separate Vercel project** for this one app, and writes the resulting `vercelProjectId`/`appUrl` back onto `appPack.apps[appId]` |
| `PATCH` | Sync DB schema | Runs `addTenantColumnsIfMissing()` (idempotent) |

`POST/DELETE /api/admin/tenants/[slug]/apps` ([route.ts](../tokenizmyapp/src/app/api/admin/tenants/%5Bslug%5D/apps/route.ts)) — add/remove an app from an existing suite. Exists, unwired to any UI button today.

None of these four+two endpoints have: a per-app **Edit** (rename/re-template/re-brand one app), a per-app **User Management** view, a per-app **Refresh Status** (the tenant-level version reconciles Vercel deploy state *and* license into one combined status — no per-app equivalent), a per-app **Trigger Deploy Hook**, or a per-app **Refresh Domain**. See the roadmap doc for what's needed to add these.

---

## Summary table — tenant-level vs. what would need to become app-level

| Wizard step | Currently | Should stay tenant-level (shared default) | Should become app-overridable |
|---|---|---|---|
| Template & Branding | Tenant only | Display name, primary/secondary color as suite-wide defaults | Per-app template + per-app color override (suite apps already pick different `templateId`s at creation time — editing should match) |
| Preview / Favicon | Tenant only | Favicon (one browser tab icon per Vercel project is a per-*deployment* concept, not per-tenant) | N/A — actually this one is arguably **already wrong**: favicon should be per-app, since each suite app is its own Vercel project |
| Slug | Tenant only | N/A | N/A — apps use `${tenantSlug}__${appId}`, not independently renamable slugs today |
| License | Tenant only | Yes — one license per tenant makes business sense | No |
| Features | Tenant only | Reasonable default set | Yes, ideally — a suite app for "Reviews & Analytics" may not need `mapreduce` |
| OpenAI API-Keys | Tenant only | Reasonable shared default | Yes, if apps have divergent AI usage/billing needs |
| Google OAuth | Tenant only | Yes, mostly (one GCP project per tenant is simplest) | Redirect URIs at minimum need to account for each app's own `appUrl` |
| Database | Tenant only | N/A | Already per-app (`dbUrl` on `SuiteAppInstance`) — wizard just doesn't expose it |
| Custom Env | Tenant only | Shared vars (e.g., feature flags) | App-specific vars (e.g., a per-app API integration key) |
| Deploy Hooks | Tenant only | N/A | Must become per-app — each app has its own Vercel project |
| Functional Roles | Global (not even tenant-scoped in this wizard) | Should be tenant-scoped by default | Optionally app-scoped (the DB columns already support this from this session's earlier scoping work) |
| Custom Domain | Tenant only | N/A | Must become per-app — each app has its own Vercel project and could have its own domain |
| Admin & Auth | Tenant only | Reasonable shared default | Possibly per-app for large multi-department suites |
| Flight Check | Tenant only | N/A | Needs a per-app variant |

See [`TENANT-APP-CONFIG-SEPARATION-ROADMAP.md`](./TENANT-APP-CONFIG-SEPARATION-ROADMAP.md) for the step-by-step plan to close these gaps and add the requested per-app three-dot menu.
