# Vercel Workflow SDK — XLSX Upload → AI Comprehension → Template-Mapped DB Population

**Status**: ALL PHASES COMPLETE (Phases 0–5) — 2026-07-31
**Date**: 2026-07-31
**App**: `tokenizmyapp/` (Next.js 16.2.9, React 19, ZenStack/Prisma, Neon Postgres, MUI, RTK Query)
**SDK source**: `docs/workflow-vercel/workflow-sdk.txt` + live API reference

---

## 1. Goal

Replace the synchronous, single-request AI workbook pipeline (`POST /api/config/reseed` → `runAiWorkbookPipeline`, 300s `maxDuration`, in-request OpenAI calls) with a **durable Vercel Workflow** that executes the same business logic as suspendable, individually-retried steps:

```
READ/EXTRACT → ANALYZE (sheet categorization) → COMPREHEND (OpenAI) → POPULATE DB → GENERATE content
```

whose **results structure** (comprehended sheets, projections, pages/blocks) is mapped to the **templates available in the schema** (`TEMPLATE_CATALOG` + `BlockType` enum + `AppPage`/`PageSection`/`FinancialProjection`/`KnowledgeSnippet` models).

| Concern | Today (sync) | With Workflow SDK |
|---|---|---|
| Execution window | 300s hard cap, whole pipeline in one invocation | Each step is its own invocation; `sleep()` costs nothing |
| Failure handling | Whole pipeline retried from scratch | Per-step auto-retry (default 3 attempts); `FatalError` stops only doomed steps |
| Progress UX | In-request `onProgress` callback only | **Streamed** — steps write to `getWritable()`, client reads `run.getReadable()` |
| Cost | Function held open during OpenAI waits | Suspended between steps (Fluid compute) |
| Observability | Logs only | `npx workflow web`, `npx workflow inspect runs`, Vercel dashboard |

---

## 2. Current Architecture (baseline)

```
POST /api/config/reseed (multipart form; excel[] + md + mode + model)
  ├─ requireWriteAuth + requireCapability('config:write')
  ├─ validateExcelUpload (≤15 MB each), validateMarkdownUpload (≤5 MB)
  ├─ mode == 'ai' (default) & excel present:
  │    ├─ seedFromSources({ overrides, skipFinancialProjections: true })   ← base seed w/o projections
  │    └─ runAiWorkbookPipeline({ buffers, db, model })                     ← THE PIPELINE (sync)
  │         ├─ 1. EXTRACT   renderAllSheetsForAi(buf) → text blocks
  │         ├─ 2. COMPREHEND comprehendWorkbook(buffers, model) → OpenAI gpt-4o → Zod-validated
  │         │      WorkbookComprehensionSchema { workbook, sheets[], projections[], template? }
  │         ├─ 3. POPULATE  upsertProjectionRaw (per projection, $executeRaw upsert)
  │         │               upsertSheetPages (app_pages + page_sections, slug sheet-<tab>)
  │         │               registerDynamicPages (setDynamicPages runtime catalog)
  │         │               saveComprehensionSnippets (knowledge_snippets upserts)
  │         └─ 4. GENERATE  generateAndSave(db, emit, buffers, model, context) → BR → ES → Dashboard Data
  │    └─ on failure → fallback deterministic seedFromSources (legacy parser)
  └─ mode == 'deterministic' → legacy seedFromSources
```

Callers: `src/store/apis/config-api.ts` (RTK Query mutation) → `src/components/config/source-upload-form.tsx` (single blocking submit).

## 3. Target Architecture (with Vercel Workflow)

```
POST /api/config/reseed
  ├─ auth + validation (unchanged)
  ├─ await start(handleWorkbookIngest, [input])     ← returns Run object immediately (durable run)
  └─ 202 { runId: run.runId, status: 'started', counts, filesUsed, uploaded }

GET /api/config/reseed/status?runId=…               ← getRun(runId) → { status, error?, result? }
GET /api/config/reseed/stream?runId=…               ← SSE: run.getReadable() → live progress chunks
                                                      (written by steps via getWritable())

workflows/workbook-ingest/index.ts   ← NEW, "use workflow" orchestrator
  handleWorkbookIngest(input)
    ├─ step loadWorkbookStep(refs)                    "use step"  (fetch bytes → Uint8Array[])
    ├─ step extractSheetsStep(buffers)                "use step"  (renderAllSheetsForAi)
    ├─ step analyzeSheetsStep(blocks)                 "use step"  (deterministic pre-pass)
    ├─ step comprehendWorkbookStep(blocks, hints, model)  "use step"  (OpenAI; retry policy §4.2)
    ├─ sleep("1s")                                   ← free pause, no resource hold
    ├─ step selectTemplateStep(comprehension)        "use step"  (§5.5 fit scoring)
    ├─ step populateProjectionsStep(comprehension)   "use step"  (raw SQL upserts)
    ├─ step upsertSheetPagesStep(comprehension)      "use step"  (app_pages/page_sections + fix §7.1)
    ├─ step registerDynamicPagesStep(comprehension)  "use step"  (setDynamicPages)
    ├─ step saveSnippetsStep(comprehension)          "use step"  (knowledge_snippets)
    ├─ step generateBusinessReviewStep(...)          "use step"  (3 sub-steps with sleep seams)
    ├─ step generateExecutiveSummaryStep(...)        "use step"
    ├─ step generateDashboardStep(...)               "use step"
    └─ return runSummary (mirrors AiPipelineResult)

Runtime wiring (auto by SDK):
  src/app/.well-known/workflow/**   ← generated route handlers (workflowEntrypoint/stepEntrypoint)
  next.config.ts wrapped with withWorkflow()
  Local World in dev (.workflow-data/), Vercel World in prod (zero config)
```

Frontend: upload form POSTs once → opens SSE stream (RTK Query `queryFn` with fetch + ReadableStream reader) → renders per-step progress; deterministic mode stays synchronous for fallback.

---

## 4. Verified API Surface (pinned from workflow-sdk.dev, 2026-07-31)

### 4.1 Functions we will use

| Import | Signature / behavior | Where used |
|---|---|---|
| `workflow/next` → `withWorkflow` | `withWorkflow(nextConfig)` — webpack/turbopack transform for `"use workflow"`/`"use step"` | `next.config.ts` (Phase 0) |
| `workflow/api` → `start` | `start(fn, [args], { deploymentId? }): Promise<Run>` — enqueues, returns immediately; args must be serializable; each call creates a new run | reseed route (Phase 4) |
| `workflow/api` → `getRun` | `getRun(runId): Run` — non-blocking; `run.status`, `run.exists`, `run.getReadable()` (with `getTailIndex()`), `run.wakeUp()` | status route (Phase 4) |
| `workflow` → `sleep` | `sleep("5s" \| Date)` — suspends run, zero resources, deterministic/replay-safe | seams between stages (Phase 5) |
| `workflow` → `fetch` | Special step fn wrapping global fetch — auto retry semantics; `response.json()/text()` auto-step | OpenAI call in comprehension step (Phase 2) |
| `workflow` → `getWritable` | `getWritable<W>()` (workflow) / `getWritable({ namespace? })` (step) → run's `WritableStream`; **workflow fn may only obtain/pass it, steps write** | progress events (Phase 4) |
| `workflow` → `FatalError` | `new FatalError(msg)` — step marked failed, **no retry** | missing API key / invalid xlsx / schema rejection (Phase 2) |
| `workflow` → `RetryableError` | `new RetryableError(msg, { retryAfter: "5m" \| ms \| Date })` — retry with backoff | OpenAI 429 / rate limit (Phase 2) |
| `workflow` → `getWorkflowMetadata` / `getStepMetadata` | run/step context inside workflow fn | run bookkeeping (Phase 5) |
| `workflow` → `createHook` / `defineHook` / `createWebhook`; `workflow/api` → `resumeHook` / `resumeWebhook` / `getHookByToken` | suspend on external payload; deterministic token idempotency | completion webhook / run idempotency (Phase 5.5, optional) |
| `@workflow/vitest` → `workflow()` plugin + `setupWorkflowTests` / `waitForSleep` / `waitForHook` | in-process Local World; plugin does SWC transform + bundle + global setup | tests (Phase 1–5) |

### 4.2 Error & retry policy for the pipeline

- **Default**: unhandled `Error` in a step → auto-retry, **max 3 attempts** (then propagates to workflow, run fails).
- `RetryableError` — only when we want a custom delay (e.g. OpenAI 429 → `retryAfter` from `Retry-After` header).
- `FatalError` — permanent: missing `OPENAI_API_KEY`, unreadable workbook, Zod schema rejection after N attempts, DB connection misconfig. **Run fails with actionable message; no retry storm.**
- Idempotency: `fetch`-based steps must be safe to replay — OpenAI chat completion is deterministic per identical input (temperature 0.2 already set in `comprehendWorkbook`) → safe.

### 4.3 Serialization contract (what can cross the workflow/step boundary)

- Standard JSON + `Date`, `bigint`, `Map`, `Set`, `RegExp`, `URL`, `URLSearchParams`, **`Uint8Array`/`ArrayBuffer`/all TypedArrays**, `Request`/`Response`, `ReadableStream`/`WritableStream`.
- **⇒ xlsx buffers pass as `Uint8Array[]` args directly** (≤15 MB each, validated upstream). `Buffer` is NOT available in workflow functions (Node API) — convert to `Uint8Array` at the route boundary (`Buffer.from(buf)` → `new Uint8Array(buf)`).
- **Pass-by-value**: steps receive deserialized copies; always return modified data (no in-place mutation of args).
- **Deterministic globals**: `Math.random()`, `Date.now()`, `crypto.randomUUID()` are **seeded/fixed per run** inside workflow functions → our `pageId`/section-id generation is replay-safe for free.
- `process.env` is a frozen snapshot at start — read-only in workflows.
- No Node modules in workflow fn (`fs`, `path`, `crypto`, `Buffer`, timers) — all I/O lives in steps.

### 4.4 Worlds (storage/queuing backends)

- **Local dev**: Local World, zero config, data in `.workflow-data/`, steps process synchronously.
- **Vercel prod**: Vercel World, zero config; durable storage + managed queuing + scaling + dashboard observability. **Enable Fluid compute** (every resume without it = cold start → cost blowup).
- **Self-host alternative**: `WORKFLOW_TARGET_WORLD=@workflow/world-postgres` + `DATABASE_URL` (our `POSTGRES_URL` exists if ever needed).

---

## 5. Results Structure → Template Mapping (the "maps best to templates" design)

### 5.1 Schema surface we populate

| Model / table | Key columns | Uniqueness |
|---|---|---|
| `AppPage` → `app_pages` | slug, title, authTier, sortOrder, navLabel, showInNav, tenantSlug | slug unique |
| `PageSection` → `page_sections` | pageId FK, sortOrder, blockType (**BlockType enum**), config JSON | per page+order |
| `FinancialProjection` → `financial_projections` | period, year, month, dataType, scenario, revenue, ebitda, netIncome, guests, staffCost, pnlLines | (period, dataType, scenario) |
| `KnowledgeSnippet` → `knowledge_snippets` | key, content, category | key unique |

`BlockType` enum values available: `hero, metric_grid, chart_financial, lever_accordion, action_checklist, doc_markdown, pnl_table, z_report_form, costs_form, calendar_import, chat_panel, kpi_cards, ops_admin_tabs, review_blocks, reports_rollup, sheet_viewer`.

### 5.2 Template catalog (`src/domain/tenant/template-catalog.ts`)

12 templates, each `TemplateDefinition { id, label, defaultPages: {slug,title,authTier,blockTypes[]}[], defaultNavItems[], schemaOrgType, xsdStandard, defaultColors }`:

`financial-analytics`, `restaurant`, `hotel`, `ecommerce-retail`, `healthcare`, `supply-chain`, `real-estate`, `education`, `professional-services`, `manufacturing`, `platform-admin`, `default`.

The comprehension prompt already constrains the AI to suggest from: `financial-analytics, restaurant, hotel, education, ecommerce-retail, healthcare, manufacturing, professional-services, real-estate, supply-chain` (platform-admin/default reserved).

### 5.3 Comprehension → mapping contract (AI output shape)

`WorkbookComprehensionSchema` (already in code) produces:

```
workbook:   { title, company?, period?, currency?, summary }
sheets[]:   { tabName, category (12 values), title, summary, periodHint?, columns[], rowCount?, metrics[] }
projections[]: { period 'YYYY-MM', dataType actual|forecast, scenario, revenue?, ebitda?, netIncome?, guests?, staffCost? }
template?:  { id (catalog), confidence 0..1, reason }
```

### 5.4 Mapping rules (target state)

| Comprehension output | → Schema write | Rule |
|---|---|---|
| `template.id` | template selection | Validate against `TEMPLATE_CATALOG`; unknown/absent → `default`. Store selected template + confidence in `knowledge_snippets` (`template_selection`) and in run output. |
| `template.defaultPages[].blockTypes[]` | `app_pages` + `page_sections` for template's core pages | Only when provisioning a **fresh tenant**; for re-upload keep existing pages, upsert by slug. |
| Each `sheets[]` (category) | One `app_pages` row (`sheet-<slug>`, authTier `google`, showInNav true) | Slug collision → upsert (with id re-select, §7.1). |
| `sheets[].category` | `page_sections` block set | `CATEGORY_BLOCKS` map (already in `pipeline.ts`): e.g. `profit_loss → pnl_table + chart_financial`; `daily_sales → sheet_viewer + chart_financial`; `break_even → kpi_cards + chart_financial`; else `sheet_viewer`. Plus `doc_markdown` intro section with AI summary. |
| `sheets[].metrics[]` + `projections[]` | `financial_projections` upserts | Conflict `(period, data_type, scenario)` → DO UPDATE. |
| `sheets[].summary` + raw JSON | `knowledge_snippets` (`sheet_<slug>`, `workbook_comprehension`) | Upsert by key. |
| Template `defaultNavItems` | `NavigationItem` | Only on fresh-provision path (out of scope for re-upload; noted for completeness). |

### 5.5 Template-fit decision (new step)

Add a deterministic **template-fit scoring step** after comprehension (cheap, no LLM):
- Score = `confidence` from AI × category-profile overlap (e.g. ≥3 sheets categorized `profit_loss/break_even/variance` → `financial-analytics` boost; `menu/daily_sales` → `restaurant`) × schemaOrgType match with workbook domain keywords.
- Emit `templateFit: { recommended, alternatives[], score, reason }` as run output + `template_selection` snippet.
- This makes mapping **deterministic-and-auditable** while keeping AI suggestion as a strong prior.

---

## 6. Phased Roadmap

### Phase 0 — Foundation & SDK wiring (½–1 day)

Tasks:
- [x] `npm i workflow@latest` — **verify version ≥ 4.0.1-beta.26** (Next 16.1+ compat); live docs show v5 beta line exists (`5.0.0-beta.33` adds multi-region on Vercel World) — pin latest and re-verify. *(Installed `workflow@4.7.0` via bun — npm arborist crashes on `@tenants/shared: file:./shared` link.)*
- [x] Add `@workflow/vitest` as devDependency. *(`@workflow/vitest@4.0.15`.)*
- [x] Wrap `next.config.ts`: `export default withWorkflow(withBundleAnalyzerConfig(nextConfig))`. *(next.config.mjs — wrapped with `withWorkflow()`.)*
- [x] Register `workflow()` plugin in `vitest.config.ts` (in-process Local World for tests).
- [x] Verify dev server boots; Local World auto-creates `.workflow-data/`; generated routes appear under `src/app/.well-known/workflow/**`. *(Local World data dir: `.next/workflow-data` — verified via CLI debug.)*
- [x] Smoke test: scratch `workflows/ping.ts` + scratch route `await start(ping, [])`; confirm run visible via `npx workflow inspect runs` and `npx workflow web`; delete scratch. *(Run `wrun_01KYVEPV5VCNKVCGG33QYR5K4V` completed; stream chunk `{"step":"ping","message":"ping-step done","pct":100}` persisted; scratch files deleted.)*
- **Accept**: dev boot OK, generated routes exist, smoke run visible, `npx vitest run` still green (165/165). ✅
- **Files**: `next.config.ts`, `package.json`, `vitest.config.ts`, `.env.local`, scratch `workflows/ping.ts`.

### Phase 1 — Workflow skeleton + EXTRACT/ANALYZE steps (1 day)

- [x] Create `workflows/workbook-ingest/index.ts` (orchestrator) + `workflows/workbook-ingest/steps.ts` (split files per SDK guidance to avoid bundler bugs).
- [x] `WorkbookIngestInput` = `{ files: { name: string; data: Uint8Array; size: number }[], model?, skipContentGeneration? }` — **Uint8Array is serializable** (§4.3); no blob store needed at this size.
- [x] Step `loadWorkbookStep(files)` — normalize `Uint8Array` → `Buffer` inside step (Buffer is fine in steps). *(Kept Uint8Array end-to-end — `xlsx.read` accepts `type:'buffer'` with Uint8Array; added magic-byte validation PK/BIFF to catch non-spreadsheet uploads since SheetJS is lenient with plain text.)*
- [x] Step `extractSheetsStep(buffers)` — `renderAllSheetsForAi` per buffer; `FatalError` if a file is not a readable xlsx.
- [x] Step `analyzeSheetsStep(blocks)` — deterministic pre-pass: tab names, row/col counts, numeric density, currency hints (reuse `financial-excel.ts` heuristics read-only) → `AnalysisHints` fed into comprehension prompt. *(Implemented in `src/domain/ai-workbook/sheet-analysis.ts` — currency/period/label hints, category guess via label scoring, workbook-level aggregates.)*
- [x] Progress: steps write stage markers via `getWritable()` (helper `emitProgress(step, message, pct)`). *(`emitProgressStep`/`closeProgressStep` in steps.ts; writable passed from workflow fn; stream closed at end — verified 5 chunks persisted.)*
- [x] Tests via `@workflow/vitest`: run workflow in-process with mocked OpenAI + DB; assert run output + stage markers. *(`workflows/workbook-ingest/index.test.ts` — 6 tests: extract/analyze assertions, stream chunks, FatalError paths, empty-tab handling, replay determinism; vitest include extended with `workflows/**/*.test.ts`.)*
- **Accept**: workflow runs end-to-end up to (not including) OpenAI; per-step I/O visible in Web UI; `AnalysisHints` documented. ✅ *(Dev-server smoke: scratch route → `start(handleWorkbookIngest)` → run `wrun_01KYVGG9B9BW0R517Q6J07CF48` completed; output `stage:'analyzed'`, 2 sheets, IDR, June; 5 stream chunks verified; scratch route deleted. Full suite 171/171 green, type-check clean.)*
- **Files**: `workflows/workbook-ingest/index.ts`, `workflows/workbook-ingest/steps.ts`, `workflows/workbook-ingest/progress.ts`, `workflows/workbook-ingest/types.ts`, `src/domain/ai-workbook/extract-sheets.ts`, `src/domain/ai-workbook/sheet-analysis.ts`, tests.

### Phase 2 — COMPREHEND step (OpenAI) (1 day)

- [ ] Step `comprehendWorkbookStep(blocks, hints, model)` — wraps `comprehendWorkbook` (OpenAI `gpt-4o`, `response_format: json_object`, Zod `WorkbookComprehensionSchema`).
- [ ] Error policy per §4.2: 429 → `RetryableError({ retryAfter })` from `Retry-After`; 5xx/timeout → plain `Error` (auto-retry ×3); missing key / schema rejected after retries → `FatalError`.
- [ ] Use `fetch` from `workflow` (or keep step-local `fetch` + manual handling) — decide per §9 Q2.
- [ ] Emit comprehension into run output (JSON-safe ✓) + `sleep("1s")` seam before populate.
- **Accept**: OpenAI failure mid-run retries without re-running extraction; permanent failure aborts run with clear `FatalError`; run output shows comprehension payload.
- **Files**: `workflows/workbook-ingest/steps.ts` (+ prompt tweak to consume `AnalysisHints`).

### Phase 3 — POPULATE steps + bug fix (1 day)

- [x] `populateProjectionsStep(comprehension)` — move `upsertProjectionRaw` loop from `pipeline.ts` into step (raw SQL upserts via `pg` driver — no Prisma in the bundle; idempotent by `(period, data_type, scenario)`).
- [x] `upsertSheetPagesStep(comprehension)` — move `upsertSheetPages` + **fix §7.1 bug** (RETURNING id on conflict → re-select existing `app_pages.id` before inserting `page_sections`). No orphan FK references.
- [x] `registerDynamicPagesStep(comprehension)` — `setDynamicPages` (best-effort runtime catalog via dynamic import; DB is source of truth, §7.3).
- [x] `saveSnippetsStep(comprehension)` — `knowledge_snippets` upserts (raw comprehension + per-sheet). Removed `created_at`/`updated_at` (schema drift — columns don't exist in live DB).
- [x] `selectTemplateStep(comprehension)` — §5.5 scoring: AI confidence × category overlap × keyword match against 10 template profiles hardcoded for bundle-leanness; returns `templateFit` with recommended, alternatives, score, reason.
- **Accept**: re-upload same workbook twice → identical rows (idempotency verified); no orphan `page_sections`; template recommendation auditable in run output. ✅ *(10/10 workflow tests pass, 175/175 full suite, type-check clean. DB writes confirmed: 2 projections, 2 pages, 3 snippets.)*
- **Files**: `workflows/workbook-ingest/steps.ts` (+6 step functions, +`normalizeSlug`, +`SHEET_CATEGORY_BLOCKS`), `workflows/workbook-ingest/db.ts` (pg helper), `vitest.config.ts` (dotenv + testTimeout), `package.json` (+pg@8.22.0).

### Phase 4 — Route integration: start + status + SSE stream (1–2 days)

- [x] `POST /api/config/reseed`: in AI mode — validate as today → build input (`Uint8Array[]`) → `const run = await start(handleWorkbookIngest, [input])` → `202 { runId: run.runId, status: 'accepted', counts, filesUsed, uploaded }`. Deterministic mode unchanged (sync). *(Sync `seedFromSources` for base items kept; only `runAiWorkbookPipeline` replaced with durable workflow.)*
- [x] New `GET /api/config/reseed/status?runId=` — `getRun(runId)`: `run.exists` → 404; `run.status` → `{ status: 'completed'|'failed'|'running', runId, result?, error? }`. Maps to `AiPipelineResult` shape for UI compat.
- [x] New `GET /api/config/reseed/stream?runId=` — SSE: `run.getReadable()` → event stream; Web ReadableStream piped as `text/event-stream`. Chunks from `getWritable()` forwarded as `data:` lines.
- [x] `dbUrl` resolution: route populates `input.dbUrl` from tenant context — root app uses `process.env.POSTGRES_URL`; per-tenant apps look up `tenants.db_url`. Workflow DB steps use `input.dbUrl` (never `process.env` directly).
- [x] Update UI *(Phase 4.5 — frontend updated with SSE progress, polling fallback, and LinearProgress bar.)*
- **Accept**: POST returns 202 with runId; status poll shows 'running' → 'completed'; SSE stream contains all progress stages; deterministic mode unchanged. ✅ *(175/175 tests pass, type-check clean; workflow tests validate full pipeline including DB writes.)*
- **Files**: `src/app/api/config/reseed/route.ts` (updated — sync pipeline replaced with `start()`), `src/app/api/config/reseed/status/route.ts` (new), `src/app/api/config/reseed/stream/route.ts` (new).

### Phase 5 — GENERATE sub-steps + completion hooks (1 day)

- [x] `generateBusinessReviewStep(comprehension, apiKey, dbUrl, model)` — builds prompt from comprehension, calls OpenAI for BR, parses into Part-sections, saves via pg to `business_review_parts`. Lightweight inline prompt-builder + parser (no deps on excel-extractor/prompt-builder).
- [x] `generateExecutiveSummaryStep(comprehension, apiKey, dbUrl, model)` — calls OpenAI for ES, saves to `knowledge_snippets` via pg ON CONFLICT (`key`) DO UPDATE.
- [x] `generateDashboardStep(comprehension, apiKey, dbUrl, model)` — calls OpenAI for dashboard data, saves to `knowledge_snippets`. Non-critical — errors swallowed.
- [x] Sleep seams between steps: `sleep("1s")` between BR → ES → Dashboard (free pauses, no resource hold).
- [x] Wire into orchestrator: runs after POPULATE, stage becomes `'complete'`, result includes `contentGenerated`, `brParts`, `esSaved`, `dashboardSaved`.
- **Accept**: AI content generation runs as durable steps with retry; sleep seams are free; run output shows all generation results. ✅ *(10/10 workflow tests pass, 175/175 full suite, type-check clean.)*
- **Files**: `workflows/workbook-ingest/steps.ts` (+3 generate steps + helpers), `workflows/workbook-ingest/index.ts` (orchestrator extended), `workflows/workbook-ingest/types.ts` (+complete stage), `src/store/apis/config-api.ts` (+async types + polling), `src/components/config/source-upload-form.tsx` (SSE progress + runId handling).

### Phase 6 — Observability, deploy, cleanup (½ day)

- [ ] Enable **Fluid compute** on Vercel project (required for cost-efficient resumes).
- [ ] Deploy; verify `src/app/.well-known/workflow/**` in build output; run a real reseed from production UI; inspect run in Vercel dashboard / `npx workflow web`.
- [ ] Persist run bookkeeping: `workbook_run` snippet (runId ↔ input refs) for post-hoc debugging.
- [ ] Prune policy: Vercel World default retention; document (Q3).
- [ ] **Decommission**: keep sync `pipeline.ts` behind `engine=workflow|sync` flag for rollback until stable; then fold AI-mode sync branch into fallback only.
- **Accept**: production reseed runs durably; rollback path documented (flag flip); docs updated (`docs/reseed-fix-plan-review.md`, this roadmap → implementation notes).
- **Files**: Vercel project settings, `.env`, `pipeline.ts` (optional trim), docs.

### Phase 7 (stretch) — Chat/resume & multi-tenant hardening

- [ ] `WorkflowChatTransport` (`@ai-sdk/workflow`; `@workflow/ai` deprecated) for AI chat that survives function timeouts (uses `x-workflow-run-id` header) — aligns with the app's AI chat panel.
- [ ] Run idempotency via deterministic hook token + `getHookByToken()` + `hook.getConflict()` (guards duplicate reseed of same upload).
- [ ] Per-tenant isolation: run input carries `tenantSlug`; verify `app_pages.tenant_slug`/`knowledge_snippets` scoping in workflow writes.
- [ ] Multi-region pinning on Vercel World (v5.0.0-beta.33+) if relevant.

---

## 7. Known Bugs & Risks to Fix During Migration

### 7.1 (Fix in Phase 3) `upsertSheetPages` orphan-section bug
`pipeline.ts` `upsertSheetPages`: `INSERT INTO app_pages … ON CONFLICT (slug) DO UPDATE` keeps the **existing row's id**, but `page_sections` inserts then use the **new random `pageId`** → sections either fail FK or orphan. Fix: on conflict, re-select existing `id` (`RETURNING`/`SELECT id FROM app_pages WHERE slug = …`) before `DELETE + INSERT page_sections` scoped to that id. Integration test: reseed twice with same workbook → exactly one page + section set.

### 7.2 Step argument serialization size
`Uint8Array` args are supported (§4.3), but each step arg is persisted to the event log. 15 MB × N files per arg is heavy. Mitigations: keep `MAX_EXCEL_BYTES` cap; if workbooks grow, switch to ref-store (Blob/bytea) and load inside the step (Q1 fallback).

### 7.3 `setDynamicPages` on serverless
In-memory page catalog is per-instance; after a workflow run, other instances won't see it until boot-time load from DB. Verify `page-catalog.ts` hydration from `app_pages` (persisted pages render via DB) — treat runtime catalog step as best-effort cache.

### 7.4 `Buffer` vs `Uint8Array` boundary
`Buffer` is **not available in workflow functions** — convert at route boundary (`new Uint8Array(buffer)`); inside steps convert back (`Buffer.from(u8)`). Lint/type guard to prevent accidental `Buffer` passing.

### 7.5 SSE reconnect
`run.getReadable().getTailIndex()` enables resuming a stream after refresh — mirror the `WorkflowChatTransport` pattern (negative `startIndex` + step-boundary rewind) for the progress stream. Cap lookback so a single huge step can't trigger unbounded scan.

### 7.6 SDK beta + Next 16.2
Pin `workflow@latest` (≥ 4.0.1-beta.26; v5 beta exists). If Turborepo caching is introduced later, remember `.well-known/workflow` outputs in `turbo.json` (`src/app/.well-known/workflow/**`).

### 7.7 Fluid compute requirement
Without it, resumes cold-start per step → cost blowup on a 10+-step pipeline. Gate production cutover on enabling Fluid.

---

## 8. Testing Strategy

- **`@workflow/vitest`** (verified API): add `workflow()` plugin to `vitest.config.ts` → auto `buildWorkflowTests()` (globalSetup) + `setupWorkflowTests()` (per-worker in-process Local World, cleared per invocation). Helpers: `waitForSleep(run)` → `run.wakeUp({ correlationIds })` to fast-forward `sleep()` seams; `waitForHook(run, { token })` for webhook tests.
- In-process integration: `await start(handleWorkbookIngest, [input])` with mocked OpenAI (`vi.mock('@/lib/openai'` / fetch) + real test DB → assert DB rows + run output + streamed progress. Mirrors existing `workbook-comprehension.test.ts` / `pipeline.test.ts` style (165 tests green today).
- Keep sync `pipeline.ts` tests untouched until Phase 6 decommission.
- Route tests: extend `src/app/api/config/reseed/route.test.ts` — mock `start()` → `{ runId }`; assert 202 + runId; status/stream route tests mock `getRun()`.
- Component test: `source-upload-form` SSE consumption with mocked stream chunks.
- E2E (manual on Vercel): upload June 2026 workbook → watch steps in `npx workflow web` → verify dashboard + sheet pages render.

---

## 9. Open Decisions (need owner sign-off)

| # | Question | Options | Recommendation |
|---|---|---|---|
| Q1 | Upload payload transport | `Uint8Array[]` args (serializable ✓) vs ref-store (Blob/bytea) | `Uint8Array[]` now (≤15 MB cap); ref-store as scale path (§7.2) |
| Q2 | OpenAI call inside step | `workflow` `fetch` (auto step+retry) vs manual `fetch` in step (full control) | Manual `fetch` in step + explicit `RetryableError`/`FatalError` (matches §4.2 policy exactly) |
| Q3 | Run-state retention | Vercel World default vs prune job | Default initially; document pruning in Phase 6 |
| Q4 | Sync `pipeline.ts` retention | Delete vs flag `engine=workflow|sync` | Keep behind flag for rollback until Phase 6 stabilizes |
| Q5 | Progress transport | SSE stream (`getWritable`/`getReadable`) vs polling | **SSE streaming** — first-class SDK support, real-time, reconnect via `getTailIndex()` |
| Q6 | Template re-apply on re-upload | Never vs dry-run diff | Never mutate template core pages on re-upload (only sheet pages) |
| Q7 | SDK version | v4 latest vs v5 beta (multi-region) | `workflow@latest`; verify Next 16.2 compat on install; v5 if stable |

---

## 10. Deliverables per Phase (summary checklist)

- **P0**: `workflow` installed (≥4.0.1-beta.26), `withWorkflow()` in next.config, vitest plugin registered, Local World verified, smoke run green.
- **P1**: durable EXTRACT/ANALYZE steps; progress markers streamed; run I/O visible in Web UI.
- **P2**: COMPREHEND step with §4.2 retry/FatalError semantics.
- **P3**: POPULATE steps (projections/pages/snippets/template) + §7.1 fix; idempotency proven.
- **P4**: reseed route returns `run.runId`; status route; **SSE progress stream**; UI reconnected via `getTailIndex()`.
- **P5**: GENERATE sub-steps (BR/ES/Dashboard); full-run integration test; optional webhook.
- **P6**: Fluid compute on; production validated; fallback flag documented; docs updated.
- **P7** (stretch): chat transport resume; run idempotency via hooks; tenant isolation; multi-region.

**Estimated total: ~6–8 focused dev days** (P0–P6), tests included.
