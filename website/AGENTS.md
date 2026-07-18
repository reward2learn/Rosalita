# Red Ruby Website — AGENTS.md

Development guide for the Red Ruby Bali website migration (plan v2).

## Stack (target)

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router |
| Language | TypeScript strict |
| Schema / ORM | **ZenStack** — `zenstack/schema.zmodel` is SSoT |
| UI | MUI v7 |
| State | **Hybrid:** RTK Query + `uiSlice` + `chatStreamSlice` + React Hook Form — **no Zustand** |
| Pages (MVP) | **Code-first** `src/lib/page-catalog.ts` (DB `AppPage` seeded P6; catalog wins at runtime) |
| Auth | JWT cookie `redruby.session` — write APIs use tier claims (`pin` \| `google`) |
| Database | Neon Postgres via ZenStack `createClient` |
| Testing | Vitest + RTL |
| Deploy | Vercel |

## Local development

```bash
cd website
bun install
bun run dev          # Next.js dev server (primary)
bun run type-check
bun run lint
bun run test
bun run enforce:redux
bun run seed -- --dry-run   # validate Excel/MD parsers (no DB writes)
bun run seed                # upsert financial_projections + content (requires POSTGRES_URL)
```

### Production database seed

Chart data comes from `financial_projections`, loaded from `../Red Ruby Club & Terrace Bar Cashflow Budgets.xlsx` via the seed script. **Seeding does not run on Vercel deploy** — run manually after first deploy or when the workbook changes.

1. Copy production `POSTGRES_URL` from Vercel → Project → Settings → Environment Variables (or use the same value in local `.env.local`).
2. From `website/`: `bun run seed -- --dry-run` (expect `financial_projections: 48`).
3. `bun run seed` (idempotent upserts).
4. Verify: `curl -s 'https://redrubybali.vercel.app/api/financial-overview?scenario=conservative' | head -c 200` — `labels` should list `Jan 2026` … `Dec 2027`, not `[]`.

Legacy transition (optional): `vercel dev` if you need side-by-side with unmigrated `api/*.js`.

Do **not** use Prestix deploy commands from other projects.

## Critical constraints

1. **Legacy read-only:** Do not modify `api/*.js`, `lib/*.js`, or `*.html` during migration.
2. **Schema:** Introspection-first — `@@map` to existing production tables. Preserve `financial_projections.data_type` + `scenario`.
3. **Currency:** Full IDR integers in DB/API (e.g. `411_000_000`). `K` notation is UI-only (`menu.txt`).
4. **Write auth:** JWT session claims — **not** `x-admin-key: redruby2026` in client or new route handlers.
5. **PDF:** Server-side only (`GET /api/auth?action=pdf`); Puppeteer + `@sparticuz/chromium`.
6. **No `dotenv/config`** in `src/`.

## Auth tiers

| Tier | Source | Access |
|------|--------|--------|
| `public` | No session | Legal pages, partial dashboard |
| `pin` | `verify-pin` | ops-admin writes |
| `google` | Google OAuth | Full app, review, chat, PDF |

Cookie: `redruby.session` (JWT via `jose`, `ENCRYPTION_KEY` 64 hex chars).

## Environment

| Var | Purpose |
|-----|---------|
| `POSTGRES_URL` | Neon |
| `ENCRYPTION_KEY` | JWT + AES-256-GCM for `secrets` table |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | OAuth env fallback when DB row missing |
| `GOOGLE_PROJECT_ID`, `GOOGLE_AUTH_URI` | Optional OAuth metadata for seed/env fallback |
| `SETUP_TOKEN` | Bearer for `store-key` and `store-google-oauth` |
| `OPENAI_API_KEY` | Chat/TTS (DB override via `secrets`) |

## Migration docs

| Path | Content |
|------|---------|
| `docs/knowledge-base/website-migration.md` | Stack, phases, RTK map, cutover, security, deploy |
| `docs/website-migration/USE-CASES.md` | Full UC table |
| `docs/website-migration/LEGACY-API-INVENTORY.md` | Endpoint matrix |
| `.opencode/context/workflows/website-migration-workflow.md` | Per-phase agent workflow |
| `.tmp/tasks/website-migration-README.md` | TaskManager phase index |

## Orchestrator

`website-migration-commander` — `.opencode/agent/core/website-migration-commander.md`

Phase order: **P0 → P1 → P2 → P3 → P4 (hard gate) → P6 seed → P5 dynamic UI → P7 → P8 → P9**

P5 theme/shell (no RTK) may parallel P4 after P3. **P6 blocked until P4-010 + enforce:redux.**

## Legacy layout (reference)

| Path | Role |
|------|------|
| `index.html` | Dashboard |
| `ops-admin.html` | Z-report entry |
| `api/schema.sql` | Partial schema (not all tables auto-created) |
| `api/knowledge-base.js` | Seed source → `KnowledgeSnippet` |

`daily_metrics` and `monthly_targets` require manual creation per `schema.sql` until ZenStack migrate runs.
