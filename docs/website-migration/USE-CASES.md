# Rosalita Website — Use Cases (Migration v2)

**Plan version:** 2.0  
**Sources:** Cashflow Excel, Business Review MD, Executive Summary MD, legacy `website/api/*.js`, HTML pages  
**Schema SSoT:** `website/zenstack/schema.zmodel`  
**Page SSoT (MVP runtime):** `website/src/lib/page-catalog.ts` (DB `AppPage`/`PageSection` seeded in P6, catalog wins at runtime)

## Auth tiers

| Tier | How obtained | Write APIs | Read scope |
|------|--------------|------------|------------|
| `public` | No session | None | Public pages, read-only metrics list |
| `pin` | `POST /api/auth?action=verify-pin` | Z-reports, imports, monthly actuals, POS | ops-admin, partial dashboard |
| `google` | Google OAuth | All write APIs | Full app including review, chat, PDF |

**v2 write auth:** JWT in cookie `redruby.session` — claims include `tier`. **No `x-admin-key` in client.**

---

## Data sources (P0 verified)

| Source | Key entities | IDR format |
|--------|--------------|------------|
| `Rosallita Cashflow May 24th 2026.xlsx` | `FinancialProjection` 2026–2030 | Full integers via `load_financial_data.mjs` |
| `Rosalita Executive Summary — June 2026.md` | 5 Levers, P0/P1/P2 actions, KPI targets | May 2026: revenue 411M, EBITDA 434K |
| `Rosalita Business Review — June 2026.md` | Parts A–O (`BusinessReviewPart`) | Staff cost 40%→22% target |
| `website/lib/knowledge-base.js` | `KnowledgeSnippet`, `MONTHLY_TARGETS[]` | `MONTHLY_TARGETS` → `monthly_targets` table |
| `website/api/schema.sql` | `daily_metrics`, `monthly_targets` | Not auto-created by legacy migrate |

**Review routing:** `/review/[partSlug]` from seeded MD — **no `review.html` port** (5344 lines).

---

## Use case table

### Legal & static content

| ID | Use case | Auth | Route | Block types | Source | Acceptance |
|----|----------|------|-------|-------------|--------|------------|
| UC-LEGAL-01 | View terms of service | public | `/terms-of-service` | `doc_markdown` | `terms-of-service.html` | Public; footer link from all pages |
| UC-LEGAL-02 | View privacy policy | public | `/privacy-policy` | `doc_markdown` | `privacy-policy.html` | Public; GDPR-style sections preserved |

### Authentication & session (JWT)

| ID | Use case | Auth | Route / API | Models | Source | Acceptance |
|----|----------|------|-------------|--------|--------|------------|
| UC-AUTH-01 | Google OAuth sign-in | public→google | `GET /api/auth?action=google` | — | `auth.js` | Cookie set; tier `google` |
| UC-AUTH-02 | PIN sign-in for ops | public→pin | `POST /api/auth?action=verify-pin` | `Secret` | `auth.js`, `ops-admin.html` | tier `pin`; limited nav |
| UC-AUTH-03 | Session bootstrap | any | `GET /api/auth?action=me` | — | `auth.js` | RTK `authApi.getSession`; no raw fetch in components |
| UC-AUTH-04 | Logout | any | `GET /api/auth?action=logout` | — | `auth.js` | Cookie cleared; tier `public` |
| UC-AUTH-05 | JWT-gated metrics write | pin/google | `POST/DELETE /api/metrics` | `DailyZReport` | `metrics.js` | 401 without valid JWT write tier; no admin header |
| UC-AUTH-06 | JWT-gated monthly actuals write | pin/google | `POST financial-overview?resource=monthly-actuals` | `MonthlyActualDepartment` | `monthly-actuals.js` | Same JWT guard |
| UC-AUTH-07 | JWT-gated POS OCR | pin/google | `POST /api/pos` | — | `pos.js` | Write tier required |
| UC-AUTH-08 | Store encrypted secret (setup) | SETUP_TOKEN | `POST /api/auth?action=store-key` | `Secret` | `auth.js` (handleStoreKey **undefined in legacy**) | Bearer SETUP_TOKEN; scaffold in `src/lib/auth/store-key.ts` P3 |
| UC-AUTH-09 | PDF export (authenticated) | google | `GET /api/auth?action=pdf` | `PdfJob` / `job_queue` | `auth.js` | Job queue + poll; server Puppeteer |

### Financial operations

| ID | Use case | Auth | Route / API | Models | Source | Acceptance |
|----|----------|------|-------------|--------|--------|------------|
| UC-FIN-01 | Record daily POS Z-report | pin/google | ops-admin block `z_report_form` | `DailyZReport` | Excel + `metrics.js` | Receipt images required; full IDR integers |
| UC-FIN-02 | OCR scan/parse POS receipts | pin/google | `/api/pos?action=scan\|parse` | — | `pos.js` | Parsed fields populate form |
| UC-FIN-03 | Enter monthly department costs | pin/google | `monthly-actuals` resource | `MonthlyActualDepartment`, `MonthlyActualInput` | `monthly-actuals.js` | Dept schema validation |
| UC-FIN-04 | View multi-scenario P&L projections | google (charts) | dashboard / ops-tracking | `FinancialProjection` | Excel 2026–2030 | `data_type` + `scenario` preserved |
| UC-FIN-05 | Track monthly KPI targets | google | ops-tracking | `MonthlyTarget` | Executive Summary + `knowledge-base.js` MONTHLY_TARGETS | Targets vs actuals; `monthly_targets` table |
| UC-FIN-06 | Bulk XLSX import Z-reports | pin/google | `POST metrics action=import` | `DailyZReport.entrySource` | `metrics.js` | `xlsx_daily`, `xlsx_prorate` sources |
| UC-FIN-07 | P&L drill-down by month | google | `?period=YYYY-MM` on financial-overview | `FinancialProjection.pnlLines` | `financial-overview.js` | All 4 scenario keys in response |
| UC-FIN-08 | Delete Z-report or month import | pin/google | `DELETE /api/metrics` | `DailyZReport` | `metrics.js` | Cascade resync monthly actuals |
| UC-FIN-09 | Z-report schema for dynamic form | pin/google | `GET metrics?schema=1` | — | `z-report-schema.js` | Department-specific required fields |

### Executive dashboard

| ID | Use case | Auth | Route | Blocks | Source | Acceptance |
|----|----------|------|-------|--------|--------|------------|
| UC-DASH-01 | 5 Levers overview | public/partial | `/` slug `dashboard` | `lever_accordion` | Executive Summary | Tiered visibility |
| UC-DASH-02 | Scenario target cards | public/partial | `/` | `metric_grid` | Executive Summary | Conservative/realistic/aspirational |
| UC-DASH-03 | P0/P1/P2 action checklists | google | `/` | `action_checklist` | Executive Summary | `ActionItem.priority` enum |
| UC-DASH-04 | Profitability chart | public/partial | `/` | `chart_financial` | `index.html` | RTK `financialApi`; month click |
| UC-DASH-05 | Key numbers to watch | public/partial | `/` | `kpi_cards` | Executive Summary | IDR formatting UI-only K |

### Business review content

| ID | Use case | Auth | Route | Models / blocks | Source | Acceptance |
|----|----------|------|-------|-----------------|--------|------------|
| UC-DOC-01 | Full review navigation Parts A–O | google | `/review/[partSlug]` | `BusinessReviewPart` | Business Review MD Parts A–O | Seeded P6; **no review.html port** |
| UC-DOC-02 | Part content rendering | google | `/review/[partSlug]` | `doc_markdown` | MD sections | No 5344-line HTML port |
| UC-DOC-03 | Executive summary page | google | `/summary` | `AppPage` | `summary.html` | PIN denied overlay |

### Operations & AI

| ID | Use case | Auth | Route | Blocks / API | Source | Acceptance |
|----|----------|------|-------|--------------|--------|------------|
| UC-OPS-01 | Ops admin tabbed workspace | pin/google | `/ops-admin` | `z_report_form`, `costs_form`, `calendar_import` | `ops-admin.html` | React Hook Form for Z-report |
| UC-OPS-02 | Financial tracking charts | google | `/ops-tracking` | `chart_financial`, `pnl_table` | `ops-tracking.html` | Scenario filter + drill-down |
| UC-AI-01 | AI chat with business context | google | `/ops-chat` | `chat_panel` | `chat.js`, `knowledge-base.js` | `chatStreamSlice` for SSE |
| UC-AI-02 | Voice TTS | google | `/api/chat?resource=voice` | — | `voice.js` | No API key in client |
| UC-AI-03 | Save conversation history | google | `/api/chat?resource=conversations` | `Conversation` | `conversations.js` | Session user name on insert |
| UC-RPT-01 | Legacy reports rollup | google | `?resource=reports` | — | `reports.js` | daily/weekly/monthly periods |
| UC-RPT-02 | Server-side PDF export | google | PDF job flow | `PdfJob` | `pdf-lib.js` | Poll `vjobs/status` |

### Dynamic UI (code-first catalog)

| ID | Use case | Auth | Implementation | Acceptance |
|----|----------|------|----------------|------------|
| UC-UI-01 | Resolve page by slug | tier from catalog | `page-catalog.ts` → `DynamicPage` | Catalog overrides DB at MVP |
| UC-UI-02 | Render block registry | per block | `block-registry.ts` + Zod `BlockConfig` | Unknown block type fails type-check |
| UC-UI-03 | Seed DB pages for post-MVP CMS | — | P6 `seed-from-sources.ts` | DB mirrors catalog; runtime reads catalog first |

### Security & Middleware (P9+ proxy)

| ID | Use case | Auth | Implementation | Acceptance |
|----|----------|------|----------------|------------|
| UC-SEC-01 | CSP + HSTS + security headers | public | `src/proxy.ts` sets Content-Security-Policy, Strict-Transport-Security, X-Content-Type-Options, X-Frame-Options on all matched routes | Headers present on all responses; static assets excluded via matcher |
| UC-SEC-02 | JWT session header injection | session | Proxy validates `redruby.session` JWT once per API request; strips external X-Session-* headers; injects X-Session-Tier, X-Session-Sub, X-Session-Groups, X-Session-Permissions, X-Session-Verified via `NextResponse.next({ request: { headers } })` | Guards use fast path via header check; 2-3 HMAC calls → 1 per request |
| UC-SEC-03 | Server-side auth redirect | session | Proxy checks page auth tier via public slug list; redirects unauthenticated users to `/dashboard?redirect_reason=auth_required` for non-public pages | No client-side spinner flash; redirect happens before RSC payload |
| UC-SEC-04 | Rewrite consolidation | public | 7 API rewrites moved from `next.config.mjs` → `src/proxy.ts`: OAuth callback, monthly-actuals, pos-scan/parse, voice, conversations, reports | Rewrites applied in proxy before auth checks |
| UC-SEC-05 | Group/route security independent of Role rows | session | `requireGroup`, `requireGroupAny`, `requireCapability` | `SecurityGroup`, `UserGroup` | Nav + API gating uses security-group memberships keyed by user `sub`; the `Role` table is never consulted |

### Roles & task security (functional role catalog)

| ID | Use case | Auth | Route / API | Models | Acceptance |
|----|----------|------|-------------|--------|------------|
| UC-ROLE-01 | Functional role catalog | pin/google (platform admin) | GET/PUT/DELETE `/api/admin/roles` | `Role` | Role = `code` + display `name` only; **no email / person fields** |
| UC-ROLE-02 | Person-to-role mapping | sign-in | `PERSONS` registry (`src/domain/security/persons.ts`) | `UserAccount.roleCode` | Google/PIN sign-in maps identity to functional role via the registry, never via the roles table |
| UC-ROLE-03 | Task ownership by role + user | session | GET/POST/PATCH `/api/tasks` | `Task`, `TaskAssignment`, `TaskUserAssignment`, `Role` | Viewer scoped via session `sub` / `roleCode`; role-match OR user-account match (no email matching) |
| UC-ROLE-04 | Role PIN configuration | platform admin | POST `/api/admin/roles` | `Secret` (`USER_PIN_<sub>` / `ADMIN_PIN`) | PIN secret key derived from PERSONS mapping, not role email |
| UC-ROLE-05 | User-scoped task assignment | platform admin | POST `/api/tasks/user-assignment`; GET `/api/admin/users` (`taskIds`) | `TaskUserAssignment` | Admin assigns any task to a specific user in the User Accounts tab; signed-in user sees the task + priority even without a role match; PATCH ownership extends to user-assigned tasks |

### Admin & Config workspace

| ID | Use case | Auth | Implementation | Acceptance |
|----|----------|------|----------------|------------|
| UC-ADMIN-01 | Workspace section navigation | pin | `/admin` (Platform Admin) and `/config` (Config) use a single dropdown `Select` instead of a `Tabs` strip | Same sections/indices reachable; single compact control, mobile-friendly |
| UC-ADMIN-02 | Responsive tenant wizard | pin | `TenantWizard` dialog: vertical `Stepper` on mobile, current horizontal stepper on non-mobile (`useMediaQuery` < `sm`) | Wizard usable on phones; unchanged layout on desktop |

### Performance (P9+ optimization)

| ID | Use case | Implementation | Acceptance |
|----|----------|----------------|------------|
| UC-PERF-01 | Code-split heavy components | `next/dynamic` with `ssr: false` for OpsAdminTabs (2654 lines), AiContentTab (953), SourceUploadForm (806), DataViewTab, ChatPanel, ReviewBlocks | Components split into lazy chunks; not in main bundle |
| UC-PERF-02 | Dynamic DataGrid import | `@mui/x-data-grid` (~300KB) dynamically imported in sheet-viewer-block + reports-rollup-block | DataGrid only loaded when sheet/report DataGrid renders |
| UC-PERF-03 | Lazy ChartJS registration | `ChartJS.register()` moved from module scope to first-mount `useEffect` in financial-chart.tsx + ops-admin-tabs.tsx | Chart.js not parsed on initial page load |
| UC-PERF-04 | Tree-shaken xlsx imports | `import * as XLSX` → `import { read, readFile, utils }` in 4 files | ~1MB removed from server bundles |
| UC-PERF-05 | Client→Server component conversion | 7 files: theme.ts, markdown-body, hero-block, app-providers, stub-blocks, tasks/page, tasks/[role] | 15% fewer client components; tasks/[role] fixed async/server bug |
| UC-PERF-06 | RTK Query deduplication | Confirmed: RTK Query shares cache entries for identical queries across sibling components | No duplicate `useGetChartOverviewQuery('conservative')` calls |

### PDF Export

| ID | Use case | Auth | Implementation | Acceptance |
|----|----------|------|----------------|------------|
| UC-PDF-01 | Next.js dashboard PDF export | google | `generateDashboardPdf` defaults to `/dashboard` (not `/index.html`); Puppeteer sets session cookie; `#pdfCapture` element in DynamicPage; PDF button hidden when `?pdf=1`; `@media print` CSS hides nav | PDF generated from live Next.js dashboard with full data |
| UC-PDF-02 | PDF export styling | — | `style.css` purged to 47 lines; `@media print` hides MUI AppBar/nav; `#pdfCapture` background hardcoded | Clean PDF output without shell chrome |

### CSS & Assets

| ID | Use case | Implementation | Acceptance |
|----|----------|----------------|------------|
| UC-CSS-01 | Legacy CSS purge | Deleted 1377 lines of dead CSS (1424→47 lines); removed `:root` block, reset, html/body, nav, hero, cards, sections, tables, accordions, gallery, footer, responsive breakpoints | Only `#pdfCapture` + `@media print` remain |

### Bundle Analysis

| ID | Use case | Implementation | Acceptance |
|----|----------|----------------|------------|
| UC-BA-01 | Bundle analyzer | `@next/bundle-analyzer` installed; gated on `ANALYZE=true`; script: `bun run analyze` | Visual treemap of all chunks |

---

## UC → phase mapping

| Phase | Use cases delivered |
|-------|---------------------|
| P0 | All (documented) |
| P1 | UC-AUTH-03 scaffold |
| P2 | Domain services for UC-FIN-* |
| P3 | UC-AUTH-01–09, UC-FIN-* APIs |
| P4 | RTK Query + uiSlice + chatStreamSlice + RHF |
| P6 | UC-DOC-01–03, UC-DASH-* seed data, UC-AI KB snippets |
| P5 | UC-UI-01–03, UC-LEGAL-*, shell |
| P7 | UC-DASH-*, UC-DOC-01–03, UC-OPS-02 |
| P8 | UC-OPS-01, UC-AI-*, UC-DOC-01–02 |
| P9 | UC-AUTH-*, UC-RPT-*, E2E all tiers |
| P9+ | UC-SEC-*, UC-PERF-*, UC-PDF-*, UC-CSS-01, UC-BA-01 |
| V2.1 (current) | UC-ROLE-05, UC-ADMIN-01, UC-ADMIN-02 |

---

## Non-goals (MVP)

- Admin UI to edit `AppPage` in database (post-MVP P10)
- Client-side PDF generation
- `x-admin-key` in any client bundle
- Port of `review.html` (use MD seed + `/review/[partSlug]` only)
- Greenfield schema (introspection + `@@map` only)
- Proxy/middleware rewrite: migrate from `middleware.ts` to `proxy.ts` naming convention (Next.js 16 deprecation) — **DONE**
- Legacy HTML pages: all 10 `.html` files retired; CSS purged accordingly
