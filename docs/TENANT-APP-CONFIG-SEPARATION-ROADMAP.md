# Tenant vs. App Configuration — Separation of Concerns & Roadmap

Generated: 2026-08-14
Prerequisite reading: [`TENANT-EDIT-WIZARD-DATA-MAP.md`](./TENANT-EDIT-WIZARD-DATA-MAP.md) (what data exists today and where), [`GAP-ANALYSIS-SUITE-MODE.md`](./GAP-ANALYSIS-SUITE-MODE.md) (infra-provisioning gaps G1–G5).

Goal: define a clean split between **tenant-level configuration** (set once in the edit wizard, inherited by every app) and **app-level configuration** (overridable per app), then lay out the concrete steps to add a three-dot menu per app with **Edit, User Management, Seed, Sync, Check Status, Refresh Status, Trigger Deployment Hooks, Refresh Domain.**

---

## 1. Proposed model: tenant = defaults, app = overrides

Right now every field the edit wizard writes lands in `tenants.metadata.config` and applies uniformly to every app in a suite (see data-map §2). The cleanest mental model that doesn't require a database rewrite:

```
Tenant (metadata.config)              →  the DEFAULT for every field below
  └─ App (appPack.apps[i])            →  optional per-app OVERRIDE; falls back
                                          to the tenant default when absent
```

This mirrors the resolution pattern already built this session for the admin subtabs (`tenantSlug` + optional `appId`, falling back to tenant-wide behavior when `appId` is absent) — same shape, applied one layer up to the *wizard's* config fields instead of just the *subtab* data.

### Classification

| Category | Fields | Stays tenant-only | Becomes app-overridable |
|---|---|---|---|
| **Identity** | Display name, template, colors | Tenant display name = suite name | ✅ Each app already has its own `name`, `department`, `templateId` at the data-model level — the wizard should let you edit them |
| **Branding** | Favicon, logo | — | ✅ Favicon is inherently per-Vercel-project, so per-app |
| **Licensing** | License key/tier/expiry | ✅ One license per tenant | — |
| **Feature flags** | `features[]` | Tenant-wide default set | ✅ Per-app override list (defaults inherited, can be narrowed) |
| **Secrets** | OpenAI key, setup token, admin PIN | Tenant-wide default | ✅ Per-app override when an app needs its own key/billing |
| **Google OAuth** | Client ID/secret, redirect URIs | ✅ One GCP project per tenant (simplicity) | Redirect URIs list should auto-include every app's `appUrl`, not just the tenant's |
| **Database** | Connection strings | N/A — already per-app (`SuiteAppInstance.dbUrl`) | ✅ Already modeled, just needs wizard UI |
| **Custom env vars** | Key/value pairs | Shared defaults | ✅ Per-app additions/overrides |
| **Deploy hooks** | Hook URL, Vercel project ID | N/A — each app has its own `vercelProjectId` | ✅ Needs a new `deployHookUrl` field on `SuiteAppInstance` |
| **Functional roles** | Role catalog + PINs | ✅ Tenant-scoped by default (already supported via `tenantSlug` column) | Optional `appId` scoping (column already exists from this session's work) |
| **Custom domain** | Domain list | N/A — each app has its own `vercelProjectId` | ✅ Per-app domain list |
| **Admin & Auth** | Admin email, PIN sign-in toggle | Tenant-wide default | Per-app override only for large suites that need department-specific admins |
| **Users / accounts** | User↔tenant/app membership | — | ✅ Already fully supported end-to-end (this session's `tenantSlug`+`appId` scoping on `user_accounts`) — just needs a per-app UI entry point |

**Rule of thumb applied above:** if the underlying infrastructure resource (Vercel project, DB connection, favicon) is already provisioned per-app, the *configuration* for it should be editable per-app too. If the resource is provisioned once per tenant (GCP OAuth project, license), the configuration correctly stays tenant-level.

---

## 2. Roadmap — phased, in dependency order

### Phase 0 — Fix what's already broken (no new features, ~1-2 hours)

1. **Wire up the unreachable edit modal.** `tenant-admin-panel.tsx` renders `<EditTenantModal open={editModalOpen} .../>` but never sets `editModalOpen` to `true` anywhere ([data-map §4](./TENANT-EDIT-WIZARD-DATA-MAP.md#4-where-this-wizard-is-actually-opened-from--and-a-bug-found-along-the-way)). Add an "Edit Tenant" button/icon next to the tenant selector (or inside the `<Chip>` row at [tenant-admin-panel.tsx:194-220](../tokenizmyapp/src/components/ops-admin/tenant-admin-panel.tsx#L194)) that calls `setEditModalOpen(true)`.
2. **Delete dead code.** Remove `tenant-editor.tsx` (`TenantEditor`) — confirmed zero imports.
3. **Unify `buildDeployPayload()` and `handleSave()`'s payload construction** in `edit-tenant-modal.tsx` — they duplicate ~40 lines of near-identical mapping with subtle drift (see data-map §1 "Save vs Deploy"). Extract one `buildConfigPayload()` helper both call.

### Phase 1 — Consolidate the two Apps-list UI surfaces into one component (~half a day)

Today `tenant-dashboard.tsx` (expandable suite row, has a menu) and `tenant-admin-panel.tsx` (flat clickable list, no menu) each render `SuiteAppInstance[]` independently (data-map §5). Before adding more menu items, unify:

1. Extract a shared `<AppRow app={app} tenantSlug={...} selected={...} onSelect={...} />` component (new file `src/components/ops-admin/app-row.tsx`) that renders the row chrome (name, department, template chip, status chip, Open link) consistently in both places.
2. Extract the per-app three-dot menu into its own `<AppActionsMenu app={app} tenantSlug={...} onDone={refetch} />` component (new file `src/components/ops-admin/app-actions-menu.tsx`) — this becomes the single place the 8 menu items below are defined, consumed by both `tenant-dashboard.tsx` and `tenant-admin-panel.tsx`.
3. Swap `tenant-admin-panel.tsx`'s current plain `<Paper onClick=.../>` row (lines 241-292) to use `<AppRow>` + `<AppActionsMenu>`, keeping its existing `onSelect` → `handleAppSelect` wired for subtab scoping (selecting a row still drives `adminSelectedAppId`; opening the menu is a separate, non-navigating action — `stopPropagation` on the `MoreVertIcon` click, same pattern the "Open" chip already uses at line 285).

### Phase 2 — Backend: fill the per-app capability gaps

Target menu (mapped to what already exists vs. what's net-new):

| Menu item | Backend status | Work needed |
|---|---|---|
| **Edit** | ❌ None | New `PATCH /api/admin/tenants/[slug]/apps/[appId]/edit` (or extend existing `PATCH` on `apps/[appId]/route.ts` to accept a body instead of being schema-sync-only) accepting `{ name?, department?, templateId?, primaryColor?, secondaryColor? }`, updating the matching entry in `appPack.apps[]`. Pair with a small dialog (reuse `TemplateSelector` from `tenant-wizard.tsx`, scoped to one app) rather than a full 15-step stepper. |
| **User Management** | ✅ Data model ready | `user_accounts` already has `tenant_slug` + `app_id` columns and the admin API/RTK hooks already accept `appId` (this session's earlier work). Reuse `TenantInlineUserManager` — it already accepts an `appId` prop — inside a `Dialog` opened from the per-app menu, exactly like `tenant-dashboard.tsx` already does for the *tenant-level* "Manage Users" menu item (`setUserManager({ slug, displayName })` at line 717) but passing `appId` through. |
| **Seed** | ✅ Exists | `POST /apps/[appId]` — already wired in `tenant-dashboard.tsx` (`handleAppSeed`), just needs the same handler in the unified `AppActionsMenu`. |
| **Sync** (DB schema) | ✅ Exists | `PATCH /apps/[appId]` — already wired (`handleAppMigrate`). Same as above. |
| **Check Status** | ✅ Exists | `GET /apps/[appId]` — already wired (`handleAppCheckStatus`). Same as above. |
| **Refresh Status** | ⚠️ Partial | No per-app equivalent of the tenant-level `handleRefreshStatus` (which reconciles Vercel deploy state *and* license into one combined status + persists it). Add: call `getDeployStatus` scoped to the app's own `vercelProjectId` (new lazy query variant, e.g. `useLazyGetAppDeployStatusQuery(tenantSlug, appId)` hitting a new `GET /apps/[appId]/status` that looks up Vercel by `app.vercelProjectId` instead of the tenant's), then `PATCH /apps/[appId]` to persist `status`/`appUrl` back onto the `SuiteAppInstance`. |
| **Trigger Deployment Hooks** | ❌ None | Requires: (a) new `deployHookUrl` field on `SuiteAppInstance` (data-map §3), settable from the new per-app Edit dialog; (b) reuse the existing `useTriggerDeployHookMutation` (it's already generic — takes any hook URL) — no backend change needed there, just plumb the per-app URL through instead of the tenant's. |
| **Refresh Domain** | ❌ None | Requires a new `GET /apps/[appId]/domains` mirroring `GET /tenants/[slug]/domain` but looking up `app.vercelProjectId` instead of the tenant's `vercelProjectId`. The existing `setTenantDomain`/`getTenantDomains` service functions should already accept a `vercelProjectId` parameter internally (confirm and generalize if they currently assume "the tenant's" project) — then add a thin per-app route wrapper. |
| **Delete app from suite** *(bonus — for full CRUD)* | ✅ Exists | `DELETE /api/admin/tenants/[slug]/apps` — built, never wired to any UI button. Add as the menu's final (destructive, confirm-dialog-gated) item, matching the tenant-level "Delete" pattern already in `tenant-dashboard.tsx` (`setConfirmDelete`). |
| **Add app to suite** *(bonus — for full CRUD)* | ✅ Exists | `POST /api/admin/tenants/[slug]/apps` — built, never wired. Add an "+ Add App" button above the Apps list (both surfaces), opening a small form (name, department, templateId) that posts here, not a full wizard. |

**Sequencing note:** Trigger Deployment Hooks and Refresh Domain are the two items with zero backend today — do these *after* the Phase 2 table's "Edit" item lands, since both need somewhere to store/see the per-app `deployHookUrl` and the per-app domain list, and the Edit dialog is the natural home for that.

### Phase 3 — Wire the unified `AppActionsMenu`

Once Phase 2's endpoints exist, `AppActionsMenu` (from Phase 1) gets all 8 items, following the exact same UX pattern already proven in `tenant-dashboard.tsx`'s tenant-level menu (loading label swap e.g. `"Seeding…"`, `disabled` while in flight, `Snackbar` on completion, `refetch()` after mutation). Suggested item order (mirrors the tenant-level menu's own ordering for consistency):

```
Edit
Manage Users
──────────────
Seed
Sync DB Schema
Check Status
Refresh Status
Trigger Deploy Hook
Refresh Domain
──────────────
Remove from Suite   (destructive, red, confirm dialog)
```

### Phase 4 — Extend the edit wizard for tenant-vs-app awareness (optional, larger)

Once per-app editing exists as its own lightweight dialog (Phase 2's "Edit"), decide whether the full 15-step `EditTenantModal` should also grow app-awareness (e.g., an app picker at the top of steps 3-12 that toggles between "tenant default" and "override for App X"), or whether the split between "big tenant wizard" and "small per-app edit dialog" is the right long-term UX. **Recommendation: keep them separate.** A single app rarely needs all 15 tenant-level categories (license, GCP OAuth, custom domain infra) re-exposed — the lightweight per-app Edit dialog (name/department/template/colors/env overrides/deploy hook/domain) covers the realistic override surface without re-implementing the whole stepper per app.

---

## 3. Dependencies on the infra-provisioning gaps (G1–G4)

Per [`GAP-ANALYSIS-SUITE-MODE.md`](./GAP-ANALYSIS-SUITE-MODE.md), "Seed"/"Deploy This App" today provision using a **synthetic slug** (`${tenantSlug}__${appId}`) against the *central* database — there is no real per-app Neon branch or isolated infra yet (G1, G3). This roadmap's Phase 2 items (Refresh Status, Trigger Deploy Hook, Refresh Domain) all key off `app.vercelProjectId`, which **is** already real (each app does get its own actual Vercel project on deploy — confirmed at [apps/[appId]/route.ts:188-207](../tokenizmyapp/src/app/api/admin/tenants/%5Bslug%5D/apps/%5BappId%5D/route.ts#L188)). So the three-dot menu roadmap here is **not blocked** by G1/G3 — Vercel-side per-app actions (status/hooks/domains) work today; only the *database* side (per-app Neon isolation) remains a separate, larger effort tracked in the gap-analysis doc.

---

## 4. Summary checklist

- [ ] Phase 0.1 — Add "Edit Tenant" trigger button in `tenant-admin-panel.tsx`
- [ ] Phase 0.2 — Delete `tenant-editor.tsx`
- [ ] Phase 0.3 — Dedupe `buildDeployPayload`/`handleSave` payload construction
- [ ] Phase 1 — Extract `<AppRow>` + `<AppActionsMenu>`, use in both `tenant-dashboard.tsx` and `tenant-admin-panel.tsx`
- [ ] Phase 2.1 — Per-app Edit endpoint + dialog
- [ ] Phase 2.2 — Per-app User Management dialog (reuse `TenantInlineUserManager`)
- [ ] Phase 2.3 — Per-app Refresh Status endpoint
- [ ] Phase 2.4 — `deployHookUrl` field on `SuiteAppInstance` + per-app Trigger Deploy Hook wiring
- [ ] Phase 2.5 — Per-app domains endpoint + Refresh Domain wiring
- [ ] Phase 2.6 — Wire existing Add/Remove-app endpoints to UI buttons
- [ ] Phase 3 — Assemble the 8-item `AppActionsMenu`
- [ ] Phase 4 — (Optional) Decide on tenant-wizard app-awareness vs. keeping the lightweight per-app dialog separate
