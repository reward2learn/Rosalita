# App Pack ↔ Tenant Wizard Integration — Analysis & Roadmap

Generated: 2026-08-14
Status: **Phases 0–4 implemented 2026-08-14.** Design deviated from the original plan in
one place, kept because it's simpler and covers the same gaps: instead of wiring the
dead `presetApps`/`presetKey` params (§2 G-A/G-B) as literally proposed in Phase 0, the
3 hand-authored `SUITE_PRESETS` were retired in favor of the shared 14-category list
(business-category-prompts.ts) that Phase 2 was already going to introduce — so Phase 0
and Phase 2's category work landed together, and `presetApps`/`presetKey` were deleted
as dead code rather than resurrected. Everything else below matches what shipped. See
also the correction added to [GAP-ANALYSIS-SUITE-MODE.md](GAP-ANALYSIS-SUITE-MODE.md).

---

## 0. Executive Summary

The platform has **two separately-built "app pack" systems** that both claim the same
name and both call the same AI generation core (`app-pack-generator.ts`), but produce
structurally incompatible outcomes:

| | **Path A — "AI App Pack Generator"** (`AppPackTab`) | **Path B — "Suite Mode"** (`TenantWizard`) |
|---|---|---|
| Entry point | `/admin` tab #8 (root tenant only) + a tab inside `TenantAdminPanel` | Tenant creation wizard's "Template" step |
| Trigger | Free-text business prompt or one of 14 business-category presets | Toggle "Multi-App Suite Mode" → pick a preset or multi-select templates |
| Decomposition | Always AI (`decomposePackFromPrompt`), or fixed mock | AI (`decomposePackFromPrompt`) *or* fixed mock — **never uses the selected templates directly** |
| Materialization | Pages, nav, security groups, knowledge snippets, and a **live ZenStack schema migration** — all into **one tenant's own single database** | `SuiteAppInstance[]` — each app gets its **own separate Vercel project deployment**, sharing the parent tenant's database via a synthetic `${slug}__${appId}` scope key |
| Result shape | One tenant, N department **sections** inside one app (nav-grouped) | One tenant, N separately-**deployed** child apps (own URL, own Vercel project, own three-dot ops menu) |
| Maturity | Full pipeline incl. live schema migration; real AI mode works end-to-end | Full per-app provisioning pipeline exists (`suite-provisioning.ts` — Neon+Vercel+seed) and the whole per-app ops menu (Edit/Seed/Deploy/Status/Domain, built in the prior session) — **but wizard→server wiring has confirmed bugs (§2) that make "what you picked" diverge from "what gets created."** |

**The user's request — "select multiple templates and get one app per template, with the
same outcome as picking a predefined app pack" — is Path B's stated intent, and Path B is
architecturally the right target** (it already has real per-app deployments and the full
ops menu). It is **not implemented correctly today**: the wizard computes a nice preview
of named apps client-side and then throws it away, sending the server only a deduped list
of template IDs; the server then either returns a hardcoded 5-app mock pack unrelated to
what was picked, or lets an LLM freely decide how many apps to create. Nothing today
guarantees "N templates → N apps."

This document maps both systems in detail, lists confirmed (not hypothesized) bugs found
by reading the code paths end-to-end, and lays out a phased roadmap to converge on one
correct, predictable "pick a predefined app pack OR build a custom one from templates"
experience, available from both the tenant **creation** wizard and the tenant **edit**
wizard.

---

## 1. How Each Path Actually Works (verified by reading the code)

### 1.1 Path A — AI App Pack Generator (`app-pack-tab.tsx`)

- UI: [app-pack-tab.tsx](../tokenizmyapp/src/components/ops-admin/app-pack-tab.tsx) — a business-category dropdown prefilling one of **14** hardcoded `BUSINESS_CATEGORY_PROMPTS`, a free-text requirement box, a target-tenant selector, and a Mock/Real toggle.
- Server: `POST /api/admin/app-pack/generate` → starts a Vercel Workflow (`handleAppPackGenerate`) → resolves the **target tenant's own `db_url`** (falling back to the root DB scoped by `tenant_slug` if the tenant has none) → runs:
  1. `decomposePackFromPrompt()` / `mockDecomposePack()` — [app-pack-generator.ts](../tokenizmyapp/src/domain/app-pack/app-pack-generator.ts) — one AI call, free to invent however many department apps it wants.
  2. `generateAppDefinition()` per app — full W3C-standard-aligned models, use cases, pages, nav, UX workflow, knowledge snippets.
  3. `compileAppRows()` / `compileCeoRows()` — [app-pack-compiler.ts](../tokenizmyapp/src/domain/app-pack/app-pack-compiler.ts) — deterministic compilation to page/nav/snippet rows, flat-slug-prefixed by `packId-appId`.
  4. `materializeAppPack()` — [app-pack-materializer.ts](../tokenizmyapp/src/domain/app-pack/app-pack-materializer.ts) — **writes directly into the target tenant's single Postgres DB**: `app_pages`, `page_sections`, `navigation_items`, `knowledge_snippets`, `security_groups`. Also applies the generated ZenStack schema as **live tables** (`schemaApplied` in the UI result).
- **Nothing here creates a `SuiteAppInstance`, a second Vercel project, or a second database.** Each "app" in a Path-A pack is a nav-grouped cluster of pages inside one deployment.

### 1.2 Path B — Suite Mode (`tenant-wizard.tsx`)

- UI: [tenant-wizard.tsx](../tokenizmyapp/src/components/ops-admin/tenant-wizard.tsx) — a "Multi-App Suite Mode" switch on the Template step. Once on:
  - 3 hardcoded `SUITE_PRESETS` (`massage-spa`, `restaurant-group`, `hotel-chain`) — each with hand-written named apps (`SuiteAppPreview[]`), or
  - free multi-select from `listTemplates()` (the static catalog — 11 real business templates, §3).
  - `getEffectiveSuiteApps()` computes a **client-side-only preview**: preset apps verbatim, or (for custom multi-select) one synthetic `SuiteAppPreview` per selected template using that template's own catalog `label`/`description` as the app name/summary.
- **Confirmed bug — the preview is never what gets sent.** `handleCreate()` (line ~347) sends only:
  ```ts
  templates: isSuite ? state.templates : undefined,   // deduped template IDs
  ```
  `state.customSuiteApps` (the actual named preset apps the user just reviewed) is **read nowhere in the submit path**. `state.suitePreset` (the preset key) is also **never sent**.
- Server: `POST /api/admin/tenants` ([route.ts](../tokenizmyapp/src/app/api/admin/tenants/route.ts) line ~147) reads `templateMode`/`templates` only (no `presetKey`, no `presetApps` in the request schema at all) and calls:
  ```ts
  materializeAppPackForTenant({ tenantSlug, displayName, templates, prompt: suitePrompt, mock: !OPENAI_API_KEY })
  ```
  — `presetApps` and `presetKey` are **valid, documented parameters of `materializeAppPackForTenant`** ([app-pack-tenant-materializer.ts](../tokenizmyapp/src/domain/app-pack/app-pack-tenant-materializer.ts) lines 41–50) **that no caller ever populates.** They are effectively dead code today.
- Inside `materializeAppPackForTenant`, with `presetApps` always absent:
  - **Mock mode** (no `OPENAI_API_KEY`, the sandbox/dev default): falls straight to `mockDecomposePack()`, which **unconditionally returns the same fixed "Massage Spa Operations Pack"** (5 apps: appointments-booking, client-records, therapist-management, spa-finance, owner-dashboard) — **regardless of which preset or which templates the user actually picked.** Selecting "Restaurant Group" and selecting "Hotel Chain" produce byte-identical output in mock mode today.
  - **Real AI mode**: builds a generic prompt (`buildSuitePrompt`, also never receives `presetKey` from the caller so its preset-specific description branch is dead too) from `templates.join(', ')` and calls `decomposePackFromPrompt()` — the **same free-decomposition call as Path A**. The AI decides how many department apps to create; it is not forced to produce exactly one app per selected template.
- Provisioning **is real and already wired**: `provisionSuiteApps()` / `redeploySuiteApps()` in [suite-provisioning.ts](../tokenizmyapp/src/domain/workflow/suite-provisioning.ts) call `provisionTenantDatabase`, `deployTenant`, `seedTenantDefaults` per app and are invoked right after materialization (route.ts line ~179). The per-app three-dot ops menu built in the prior session (Edit/Seed/Deploy/Status/Domain/Remove) operates on exactly this `SuiteAppInstance[]` shape.

### 1.3 Path B, edit-time (existing tenants)

[edit-tenant-modal.tsx](../tokenizmyapp/src/components/ops-admin/edit-tenant-modal.tsx) `renderStepTemplate()` (line ~1156): if the tenant already has an `appPack`, it **only displays** the current apps in a read-only list plus a static `Alert`:
> "Template changes apply to the parent tenant only. Individual app templates can be
> modified by regenerating the suite or contacting support."

There is no "add another app from a template" or "change this app's template" control
here — despite `useAddAppToSuiteMutation`/`useRemoveAppFromSuiteMutation` and the full
per-app edit dialog already existing (built in the prior session, reachable only from the
Apps list's three-dot menu, not from this wizard step).

### 1.4 A pre-existing doc is stale — worth flagging

[docs/GAP-ANALYSIS-SUITE-MODE.md](GAP-ANALYSIS-SUITE-MODE.md) (dated 2025-08-14 — exactly
one year before today, which itself suggests a templated rather than hand-verified date)
lists **G1** ("no per-app provisioning pipeline exists") and **G3** ("provision endpoint
doesn't decompose suite apps") as 🔴 Critical, currently-broken gaps. Reading the current
code shows `suite-provisioning.ts` exists, is imported into `route.ts`, and performs real
per-app Neon+Vercel+seed provisioning right now. **G1/G3 as written are resolved** — the
actual remaining gap is the wiring bug in §1.2/§2, which that doc does not mention. Don't
trust that doc's "what's NOT working" table without re-checking against current code —
same caution applies to this document a few months from now.

---

## 2. Confirmed Gaps (verified by tracing the exact code path, not assumed)

| # | Gap | Where | Impact |
|---|-----|-------|--------|
| G-A | Preset selection (`suitePreset`, `customSuiteApps`) computed for the wizard's Review-step preview is **never sent** to `createTenant()` | `tenant-wizard.tsx` `handleCreate()` | User reviews "Menu Management, Reservations, Kitchen Operations…" and gets something else entirely once mock mode is active |
| G-B | `materializeAppPackForTenant`'s `presetApps`/`presetKey` params are unreachable dead code — no caller in the codebase ever sets them | `app-pack-tenant-materializer.ts` ↔ `route.ts` | Preset-specific named apps and preset-specific prompts can never be used, even though the code to use them was written |
| G-C | Mock mode ignores `input.templates` entirely and always returns the fixed 5-app massage-spa pack | `mockDecomposePack()` in `app-pack-generator.ts`, called unconditionally when `useMock` | Every suite tenant created without an OpenAI key (the default in this sandbox and likely in cheap/dev environments) gets an unrelated, wrong app pack |
| G-D | Real AI mode does free decomposition from a generic joined-template-names prompt; there is no code path that deterministically maps "N selected templates → N generated apps" | `decomposePackFromPrompt()` call in `materializeAppPackForTenant` | Directly contradicts the requested "select multiple templates and have **for each template** an app generated" — today the AI may merge, split, or drop templates |
| G-E | Edit wizard's Template step is read-only for existing suites; no UI reaches the already-built add/remove-app mutations from inside the wizard | `edit-tenant-modal.tsx` `renderStepTemplate()` | Growing/reshaping an existing tenant's app pack requires leaving the wizard and using the Apps-list three-dot menu one app at a time — no bulk "add these 3 templates" flow |
| G-F | Two independent 14-vs-3-category preset lists (`BUSINESS_CATEGORY_PROMPTS` in `app-pack-tab.tsx`, `SUITE_PRESETS` in `tenant-wizard.tsx`) with no shared source of truth | both files | The richer, AI-generation-tuned category list (Path A) is invisible to the wizard; the wizard's 3 presets are hand-authored duplicates covering a fraction of the same ground |
| G-G | Naming collision: both systems call themselves "App Pack" in user-facing copy with no disambiguation | `AppPackTab` heading vs. wizard's "Suite Mode"/"apps" copy | An admin cannot tell from the UI alone which of two structurally different outcomes (nav-grouped single app vs. N separately-deployed apps) they're about to get |

None of these are hypothetical — each was confirmed by reading the exact function that
receives (or fails to receive) each field, cited above with file + line references.

---

## 3. Template Catalog — Tenant-Level vs. App-Level Classification

`listTemplates()` in [template-catalog.ts](../tokenizmyapp/src/domain/tenant/template-catalog.ts) exposes 13 entries; 11 are real business templates usable as either a single-app template or one app inside a pack, 2 are structural/fallback and should stay excluded from pack-building UI:

| Template ID | Label | Usable as a pack app? | W3C standard (from `app-pack-generator.ts`) |
|---|---|---|---|
| `financial-analytics` | Financial Analytics | ✅ | FpML / FIXML |
| `restaurant` | Restaurant | ✅ | UBL + GS1 |
| `hotel` | Hotel & Hospitality | ✅ | OTA |
| `ecommerce-retail` | E-Commerce & Retail | ✅ | UBL + Inventory Feeds |
| `healthcare` | Healthcare & Clinical | ✅ | HL7/CDA |
| `supply-chain` | Supply Chain & Logistics | ✅ | UBL (shipping) |
| `real-estate` | Real Estate & Property | ✅ | RETS |
| `education` | Education & E-Learning | ✅ | IMS Global |
| `professional-services` | Professional Services | ✅ | UBL (billing) |
| `manufacturing` | Manufacturing & Industrial | ✅ | B2MML |
| `spas-and-wellness` | Spas & Wellness | ✅ | HL7 + ISO 19011 |
| `platform-admin` | Platform Admin | ❌ exclude — this is the meta-template for the root ops console itself | n/a |
| `default` | Generic Dashboard | ⚠️ fallback only — already used as the fallback in `W3C_STANDARDS`/`SCHEMA_ORG_TYPES` (`?? 'schema.org'` / `?? 'LocalBusiness'`); don't offer it as a first-class pack-building choice | n/a |

This is exactly the list `tenant-wizard.tsx`'s custom multi-select already filters to
(`templates.filter((tpl) => tpl.id !== 'default')`, line ~633) — good, no change needed
there, just confirming the roadmap's Phase 1 deterministic builder should use the same
filter and the same 11-template universe.

---

## 4. Target Architecture

**Path B (Suite Mode / `SuiteAppInstance[]`) is the canonical outcome** for "select
multiple templates → get one app per template." It already has real per-app deployment,
real provisioning, and the full ops menu. Path A stays as a distinct, legitimately useful
product (cheaper — one DB, one deployment, department-as-nav-section) but must be
relabeled to stop colliding with "App Pack" terminology (Phase 4).

Two explicit, user-selectable modes feed the **same** `SuiteAppInstance[]` materialization
and the **same** provisioning pipeline:

- **Predefined App Pack** — pick one of the (expanded, shared) business-category presets. Runs AI decomposition (`decomposePackFromPrompt` + `generateAppDefinition`) same as today, scoped by that category's tuned prompt — app count is AI-decided, matching what a "pack" implies.
- **Custom App Pack** — multi-select 2+ templates directly. Deterministic: N templates in → N `SuiteAppInstance` apps out, one per template, using that template's own `label`/`description`/`defaultPages` as the seed brief (optionally still enriched by `generateAppDefinition` in AI mode for schema depth, or `mockGenerateAppDefinition` in mock mode — but the **count and identity** of apps is never left to the AI).

Both modes are available from both wizards (creation and edit), and both dead-ends
(§2 G-A/G-B/G-C/G-D) get closed so the Review-step preview always matches what's actually
created.

---

## 5. Phased Roadmap

### Phase 0 — Wiring bug fixes (no new UI, restores correctness)
- **0.1** `tenant-wizard.tsx` `handleCreate()`: send `presetKey: state.suitePreset` and `presetApps: state.suitePreset ? state.customSuiteApps : undefined` alongside `templates`.
- **0.2** `route.ts` `createTenantSchema`: add optional `presetKey: z.string().optional()` and `presetApps: z.array(z.object({ id, name, department, summary, templateId })).optional()`; forward both into the existing `materializeAppPackForTenant()` call (the function already accepts and correctly branches on them — this is purely plumbing).
- **0.3** `buildSuitePrompt()`: now reachable with a real `presetKey` — verify its 3 hardcoded preset descriptions still make sense once Phase 2 expands presets to 14 (either extend this map or replace it — see 2.1).
- **0.4** Manual QA: create a suite tenant via each of the 3 existing presets in mock mode and confirm the persisted `appPack.apps[]` names match the preset, not the massage-spa fallback.

### Phase 1 — Deterministic "N templates → N apps" custom pack
- **1.1** Add `buildDeterministicAppPack(templates: string[], displayName: string, tenantSlug: string): AppPackDecomposition` (new export in `app-pack-tenant-materializer.ts` or a sibling module) — one `AppPackBrief` per template, `id`/`department`/`summary` sourced from `getTemplate(tplId)`, **no AI call**. Include the same CEO Overview synthesis logic already used in `mockDecomposePack`/presetApps branch.
- **1.2** In `materializeAppPackForTenant`, add a `packMode: 'deterministic' | 'ai-decompose'` input (default `'ai-decompose'` to preserve current preset/prompt behavior). When `'deterministic'`, use 1.1's decomposition instead of `decomposePackFromPrompt`/`mockDecomposePack`; still call `generateAppDefinition`/`mockGenerateAppDefinition` per app for the full definition depth.
- **1.3** `route.ts`: forward a `packMode` field from the request; the wizard sets it based on which UI mode the user is in (custom multi-select → `'deterministic'`; preset/prompt → `'ai-decompose'`).
- **1.4** Update `tenant-wizard.tsx`'s `getEffectiveSuiteApps()` custom-mode branch to be visibly identical to what 1.1 will produce (it already is, structurally — this step is about keeping them in sync as 1.1 evolves, not a rewrite).

### Phase 2 — Creation-wizard UI: shared preset list + explicit mode picker
- **2.1** Extract `BUSINESS_CATEGORY_PROMPTS` out of `app-pack-tab.tsx` into `src/domain/app-pack/business-category-prompts.ts`; import it from both `app-pack-tab.tsx` and `tenant-wizard.tsx`. Retire the 3-entry `SUITE_PRESETS` in favor of this 14-entry shared list (each category's existing prompt already reads as a natural-language app-pack description, suitable for both Path A's free-text box and Path B's `presetApps`-free AI-decompose call).
- **2.2** Template step gets a 3-way choice instead of today's single/suite toggle: **Single App** (unchanged) / **Predefined App Pack** (category dropdown from 2.1, runs Phase-1 `'ai-decompose'` mode) / **Custom App Pack** (multi-select from the 11-template catalog, runs Phase-1 `'deterministic'` mode).
- **2.3** Review step shows the same app list either way, sourced from the same preview function so what's shown always matches what Phase 0/1 will actually persist.

### Phase 3 — Edit-wizard UI: make existing suites growable/reshapeable in-wizard
- **3.1** `edit-tenant-modal.tsx` `renderStepTemplate()`: when `isSuite`, replace the read-only Alert with the same multi-select control from 2.2, pre-checked against `appPack.apps.map(a => a.templateId)`.
- **3.2** On Save: diff the new selection against current apps. Newly-checked templates → `useAddAppToSuiteMutation` with a Phase-1.1 deterministic brief. Unchecked templates whose app is not yet `live` → `useRemoveAppFromSuiteMutation`. Unchecked templates whose app **is** `live` → leave in place, surface an inline note directing the admin to the app's own three-dot menu (avoids silently orphaning a deployed Vercel project from inside a bulk-diff action).
- **3.3** Optional: a "regenerate via AI description" action scoped to only the not-yet-deployed apps, reusing Path A's richer prompt-driven generation for tenants that outgrow the deterministic seed.

### Phase 4 — Naming & product-boundary cleanup (optional, do last)
- **4.1** Rename Path A's user-facing copy (currently "AI App Pack Generator") to something that doesn't collide with Suite Mode's "App Pack," e.g. "Unified App Bundle" or "Department Sections" — same engine, clarify it produces one deployment with grouped nav sections, not N separate apps.
- **4.2** Cross-link both surfaces ("Need each department as its own deployed app with its own URL? Use Suite Mode instead.") so an admin picks deliberately.
- **4.3** Re-verify `docs/GAP-ANALYSIS-SUITE-MODE.md` against current code and correct/retire the now-stale G1/G3 entries (§1.4); fold any genuinely-still-open items (G2 tenant.template ambiguity — already fixed per route.ts comment "G2 fix"; G4 raw-SQL AppPack model; G5 dashboard visual hierarchy) into a follow-up cleanup pass rather than leaving a contradictory doc in the repo.

---

## 6. Suggested Sequencing

Phase 0 is a pure bug fix and should ship first regardless of anything else — it makes
existing preset selection behave as already documented/intended with a small, low-risk
diff. Phase 1 is the deterministic-mapping core the rest depends on. Phases 2 and 3 are
independent UI work once Phase 1 lands (2 first, since it's the more-used path — new
tenants — then 3). Phase 4 is cleanup and can happen any time after Phase 2, or be
skipped if the two-product naming collision turns out not to confuse users in practice.
