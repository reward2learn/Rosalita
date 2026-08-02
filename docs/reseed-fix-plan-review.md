# Reseed Fix — Plan Review & Status

**Subject:** `POST /api/config/reseed` 500 error + XLSX upload warnings
**Date:** 2026-07-31
**Reviewer:** Project Manager (orchestration session)

---

## 1. Plan status

| # | Step | Status | Notes |
|---|------|--------|-------|
| 1 | Investigate reseed 500 root cause | DONE | `roles.email` UNIQUE constraint collision in `prisma.role.upsert()` during seed |
| 2 | Investigate XLSX load warning | DONE | June 2026 workbook has no `RedRuby` sheet — parser rejects it (warning only, not the 500) |
| 3 | Map role usage in group/route security | DONE | Group security = `SecurityGroup`/`UserGroup` (by user `sub`); route security = session claims (`groups`/`permissions`). **`Role` table is not consulted by either.** Role is used only for task tracking + PIN secret keys |
| 4 | Codify app-dir off-limits rule | DONE | AGENTS.md HARD RULE + `.opencode/opencode.json` permission denials (read/edit/glob/grep/list on the app dir tree; bash commands containing the dir name) |
| 5 | Update use-case docs | DONE | UC-ROLE-01..04, UC-SEC-05 added |
| 6 | Apply code fix in `tokenizmyapp/` | DONE | Schema + seed + roles API + tasks route + UI + tests; `zenstack generate`; 148/148 tests pass (36 files) |
| 7 | Deploy + verify reseed | PENDING | Requires deploy (db push drops `roles.email`), then reseed with the legacy-format workbook and verify 200 |

---

## 2. Findings (reviewed & confirmed)

### 2.1 The 500 — `Unique constraint failed on the fields: ('email')`

- The `roles` table declares `email` as UNIQUE (schema `email String? @unique`, DDL `email TEXT UNIQUE`).
- The seed upserts roles keyed by `code` but also writes `email` (derived from the PERSONS person registry) in the **update** branch.
- Any collision — e.g. a stale role row from an earlier reseed (different code casing `Admin` vs `admin`) already holding that email — aborts the whole reseed -> `500` on `/api/config/reseed`.
- **Root fix:** roles should be `code` + `name` (display name) only; the person-to-role mapping belongs in the `PERSONS` registry, which already powers Google/PIN sign-in (`resolvePersonByEmail` / `resolveRoleForEmail`).

### 2.2 The XLSX warning — `RedRuby sheet missing from workbook`

- Uploaded `June 2026 - Red Ruby PT.TAMAN BINTANG BALI.xlsx` sheets: `Daily Sales, GL, TB, PL, BS, COS, Month on Month, BEP Monthly, Monthly Variance, SUMPL, SumBS` — **no `RedRuby` sheet**.
- Reference `Red Ruby Club & Terrace Bar Cashflow Budgets.xlsx` sheets: `RedRuby, Sheet1` — the format the parser expects.
- Effect: zero financial projections seeded from the upload (warning, non-fatal).
- **Mitigation (no code):** reseed with the legacy-format budget workbook, or add a `RedRuby` sheet to the June workbook in the expected layout.

---

> **App directory:** the app now lives at `tokenizmyapp/` (the former app directory was removed). All paths below are relative to `tokenizmyapp/`.

## 3. Fix checklist (APPLIED 2026-07-31 — all under `tokenizmyapp/`)

1. `zenstack/schema.zmodel` — remove `email` from `Role` model (+ regenerate via `bun run zen:generate`).
2. `src/domain/seed/seed-runner.ts` — remove `email TEXT UNIQUE` from roles DDL; drop `email` from `KNOWN_ROLES` + both role upserts.
3. `src/lib/db-migrate.ts` — remove `email TEXT UNIQUE` from roles bootstrap DDL.
4. `src/app/api/tasks/route.ts` — `resolveViewerRole`: replace email/name fallback with `PERSONS`-based mapping (`sub` to legacy task code via `legacyTaskCodeForSub`, functional roleCode to person to legacy code).
5. `src/app/api/admin/roles/route.ts` — drop `email` from `RoleConfigView` + GET; reuse centralized legacy-code mapping.
6. `src/app/api/config/seed-details/route.ts` — drop `email` from `roleDetails`.
7. UI: `src/app/(app)/admin/page.tsx`, `src/components/config/data-view-tab.tsx`, `src/components/config/source-upload-form.tsx`, `src/components/ops-admin/edit-tenant-modal.tsx` — remove Email column/state.
8. Tests: `src/app/api/admin/roles/route.test.ts`, `src/app/api/tasks/route.test.ts` fixtures.
9. ✅ `npx zenstack generate` (client regenerated — `Role` no longer has `email`); type-check clean except pre-existing stale `.next` inngest artifact; `vitest run` 148/148 green. ⏳ `db push` still required at deploy time (drops the `roles.email` column + UNIQUE index).
10. ⏳ Redeploy to Vercel; reseed with the legacy-format workbook; verify 200 + financial projections seeded.

> **Also fixed while in `tokenizmyapp/`:** per-tenant `roles` DDL + seeding in `src/domain/tenant/tenant-service.ts` (same email coupling); `vitest.config.ts` `@shared` alias (tests could not resolve shared code); `rtk-conventions.test.ts` base-query path repointed to `shared/src/store/base-query.ts`.
>
> **`RedRuby` sheet dependency REMOVED (2026-07-31):** `src/domain/seed/financial-excel.ts` rewritten to be sheet-agnostic — it now reads **every sheet**:
> - Legacy fixed-row layouts (`RedRuby`/`2027`/`2029`/`2030`) kept verbatim for backward compatibility;
> - Generic detection for everything else: label-column discovery, period axis (month-name/date columns, 4-digit year columns, or `Periode/Per/Month of` single-period labels), label matching against PNL_LINE_ITEMS + COA aliases (`Total Income`, `Total Salary And Wages`, `PROFIT AND LOSS`, `EBITDA`/derived);
> - Noise elimination: all-zero rows dropped, duplicate (period, data_type, scenario) rows deduped keeping the most complete one (e.g. PL beats GL/TB/BS/COS for 2026-06 actual);
> - Mixed layouts (annual + monthly columns, e.g. SUMPL) emit both;
> - Real June 2026 workbook now yields ~30 clean projections: 2026-06 actual (PL), 2025-01…2026-06 forecast (BEP), 2020–2025 annual actuals + 2026-01…06 monthly actuals (SUMPL);
> - 251 stale `.js` duplicates shadowing `.ts` sources removed (vitest was running old code); tests now execute the real TypeScript: **155/155 pass**.
>
> **AI Workbook Pipeline (2026-07-31) — AI-first ingestion replaces deterministic parsing:**
> - New `src/domain/ai-workbook/workbook-comprehension.ts`: every sheet serialized to text (no code interpretation) → single OpenAI call comprehends ALL sheets → Zod-validated structured JSON (per-sheet category/title/summary/metrics, consolidated `projections[]`, template suggestion from the 10-sector TEMPLATE_CATALOG). One retry on malformed output.
> - New `src/domain/ai-workbook/pipeline.ts`: `runAiWorkbookPipeline` — EXTRACT → COMPREHEND → POPULATE → GENERATE. Populates `financial_projections` (AI metrics, upsert by period/data_type/scenario), one dynamic `AppPage` per comprehended sheet (`sheet-<slug>`, block type by category, comprehension markdown + sheet/chart blocks), `knowledge_snippets` (raw comprehension + per-sheet summaries), then triggers the existing AI Content generation (Business Review → Executive Summary → Dashboard Data) with the comprehension injected as context.
> - `POST /api/config/reseed` now runs **AI mode by default** (`mode=ai`): base seed skips deterministic projections (`skipFinancialProjections`), AI pipeline supplies them; on AI failure it falls back to deterministic parsing with a warning. `mode=deterministic` restores legacy behavior.
> - Tests: 10 new (comprehension render/schema/OpenAI call/retry/error + pipeline populate/skip/failure). **Full suite 165/165 pass**.

---

## 4. Next actions

- [x] **User decision:** app directory switched to `tokenizmyapp/` (former app dir removed) — fix applied and verified.
- [x] Permission rules removed (`.opencode/opencode.json`) and AGENTS.md rule deleted.
- [ ] Deploy to Vercel (runs `zenstack generate` + `prisma db push` when `POSTGRES_URL` set) — drops `roles.email`.
- [ ] Reseed via `/api/config/reseed` using `Red Ruby Club & Terrace Bar Cashflow Budgets.xlsx` (has the `RedRuby` sheet) and confirm 200.
- [ ] (Pre-existing, unrelated) `enforce:redux` gate flags `edit-tenant-modal.tsx`, `tenant-dashboard.tsx`, `tenant-wizard.tsx`, `vercel-connect-button.tsx` — was red before this fix.
