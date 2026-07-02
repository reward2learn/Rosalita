# Rosalita Website Migration — Knowledge Base

Plan v2: legacy static HTML + `api/*.js` → **Next.js 16 App Router** with ZenStack, RTK Query, JWT auth.

## Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 App Router (`src/app/`) |
| Runtime | Node 22 (`AWS_LAMBDA_JS_RUNTIME=nodejs22.x`) |
| Language | TypeScript strict |
| Schema / ORM | **ZenStack** — `website/zenstack/schema.zmodel` is SSoT |
| UI | MUI v7 |
| State | RTK Query + `uiSlice` + `chatStreamSlice` + `authSlice` + React Hook Form — **no Zustand** |
| Auth | JWT cookie `rosalita.session` (`jose`, `ENCRYPTION_KEY`) |
| Database | Neon Postgres via ZenStack `createClient` |
| PDF | Puppeteer + `@sparticuz/chromium` (server-only) |
| Testing | Vitest + RTL |
| Package manager | **bun** (all scripts) |
| Deploy | Vercel (`framework: nextjs`) |

## Phase order (v2)

```
P0 → P1 → P2 → P3 → P4 (hard gate) → P6 seed → P5 dynamic UI → P7 → P8 → P9
```

- **P4** blocks P6 until `enforce:redux` passes.
- **P5** theme/shell (no RTK) may parallel P4 after P3.
- **P9** (this doc): deploy config, full gate, E2E API tests, security audit, cutover docs.

## RTK slice / API ownership

| Store path | Role |
|------------|------|
| `authSlice` | Client session tier, sign-in UI state |
| `uiSlice` | Shell nav, drawers, transient UI |
| `chatStreamSlice` | SSE chat streaming (`sendStreamingMessage`, token accumulation) |
| `authApi` | `/api/auth` — me, logout, verify-pin, google-config |
| `metricsApi` | `/api/metrics` — Z-reports (JWT write tier) |
| `financialApi` | `/api/financial-overview` — projections, reports |
| `monthlyActualsApi` | `/api/financial-overview?resource=monthly-actuals` |
| `contentApi` | `/api/content` — knowledge snippets, review parts |
| `chatApi` | `/api/chat` — conversations, voice |
| `pdfApi` | `/api/auth?action=pdf`, `/api/vjobs/status/[jobId]` |
| `posApi` | `/api/pos` — scan/parse |

## Catalog SSoT

| Asset | Runtime SSoT | Notes |
|-------|--------------|-------|
| Page routes / nav | `src/lib/page-catalog.ts` | Code-first; DB `AppPage` seeded P6 but catalog wins |
| Block rendering | `src/lib/block-registry.ts` | Maps `BlockType` → React components |
| Review parts A–O | `page-catalog.ts` + DB seed | Never port `review.html` |
| Menu prices (`K`) | `menu.txt` (repo root) | UI-only; API uses full IDR integers |
| Financial data | DB `financial_projection`, `daily_z_report`, etc. | `data_type` + `scenario` preserved |

## Legacy coexistence & cutover

Until production cutover, legacy files remain **read-only** reference:

| Legacy | Next.js replacement |
|--------|---------------------|
| `index.html`, `ops-admin.html`, etc. | `src/app/[slug]`, `DynamicPage` |
| `api/auth.js` | `src/app/api/auth/route.ts` |
| `api/metrics.js` | `src/app/api/metrics/route.ts` |
| `api/financial-overview.js` | `src/app/api/financial-overview/route.ts` |
| `api/chat.js` | `src/app/api/chat/route.ts` |
| `api/vjobs/status/[jobId].js` | `src/app/api/vjobs/status/[jobId]/route.ts` |

**Routing:** `vercel.json` + `next.config.mjs` share the same API rewrites (Google callback, monthly-actuals, pos-scan/parse, voice, conversations, reports).

**Cutover checklist:**
1. Preview deploy green (`bun run build`, all tests).
2. Set Vercel env vars (below).
3. Manual OAuth smoke test (see checklist).
4. Verify ops-admin Z-report write with PIN session.
5. Verify Google-tier chat + PDF export.
6. Point production domain to Next.js deployment.
7. Archive legacy HTML from active routing (keep files for reference).

## Environment variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `POSTGRES_URL` | Yes | Neon connection string |
| `ENCRYPTION_KEY` | Yes | 64 hex chars — JWT signing + AES-256-GCM for `secrets` table |
| `GOOGLE_CLIENT_ID` | OAuth | Fallback when DB `google_oauth_config` empty |
| `GOOGLE_CLIENT_SECRET` | OAuth | Server-only; never exposed to client |
| `GOOGLE_PROJECT_ID` | Optional | OAuth metadata |
| `GOOGLE_AUTH_URI` | Optional | OAuth metadata |
| `SETUP_TOKEN` | Setup | Bearer for `store-key` / `store-google-oauth` (one-time) |
| `OPENAI_API_KEY` | Chat | DB override via `secrets` table |
| `NEXT_PUBLIC_APP_URL` | Production | `https://rosalita-business-review.vercel.app` — canonical OAuth redirect origin (Vercel Production env) |

**Vercel function config:** PDF routes (`/api/auth?action=pdf`, `/api/vjobs/status/[jobId]`) use 1024 MB memory, 60s max duration, Chromium bundle via `includeFiles`.

## Commands (bun)

```bash
cd website
bun install
bun run dev              # Next.js dev server
bun run build            # Production build
bun run type-check       # tsc --noEmit
bun run lint             # eslint src
bun run test             # Vitest (71 tests)
bun run enforce:redux    # RTK conventions gate
bun run zen:generate     # Regenerate Prisma/ZenStack client
bun run seed             # Seed from legacy sources
```

## P9 automated test coverage

| Area | Test file |
|------|-----------|
| POST /api/metrics without cookie → 401 | `src/app/api/metrics/route.test.ts` |
| Auth me / logout / PIN / PDF tier | `src/app/api/auth/route.test.ts` |
| JWT write guards (pin/google) | `src/lib/auth/guards.test.ts` |
| Session cookie flags | `src/lib/auth/session.test.ts` |
| SSE chat parser | `src/lib/chat/sse-parser.test.ts` |
| PDF queue 202 + job poll | `src/app/api/auth/route.test.ts`, `src/app/api/vjobs/status/[jobId]/route.test.ts` |
| Financial IDR integers | `src/app/api/financial-overview/route.reports.test.ts` |
| No x-admin-key in RTK | `src/store/rtk-conventions.test.ts` |

## Manual OAuth checklist (not in CI)

- [ ] `GOOGLE_CLIENT_ID` / secret configured (env or DB via `store-google-oauth`)
- [ ] Visit `/api/auth?action=google` → Google consent screen
- [ ] Callback `/api/auth/callback/google` sets `rosalita.session` cookie
- [ ] `GET /api/auth?action=me` returns `tier: google` with user email
- [ ] Google-tier pages load (review parts, chat)
- [ ] `GET /api/auth?action=pdf` returns `202` with `jobId`
- [ ] Poll `/api/vjobs/status/{jobId}` until PDF base64 returned
- [ ] `GET /api/auth?action=logout` clears cookie (307 redirect)

## Security audit (P9-008)

**Automated checks performed:**

| Check | Result |
|-------|--------|
| `ENCRYPTION_KEY` in client bundle / `NEXT_PUBLIC_*` | **Pass** — only `jwt.ts`, `crypto.ts`, server routes |
| `x-admin-key` / `rosalita2026` in `src/` | **Pass** — not present; `enforce:redux` + grep clean |
| Write APIs use JWT only | **Pass** — `requireWriteAuth` / `requireGoogle` guards |
| Session cookie `HttpOnly` | **Pass** — `buildSessionCookie` |
| Session cookie `Secure` in production | **Pass** — when `VERCEL_ENV=production` |
| Session cookie `SameSite` | **Pass** — `Lax` |
| Google client secret server-only | **Pass** — `google-oauth.ts` env/DB only |
| `SETUP_TOKEN` for secret bootstrap | **Pass** — bearer required, not in client |

**Residual risks:**
- `SETUP_TOKEN` and `ENCRYPTION_KEY` must be rotated if leaked; store only in Vercel env.
- Legacy `api/*.js` still contains old `x-admin-key` pattern — do not route traffic to legacy handlers after cutover.
- OAuth redirect URI must match Google Cloud console for preview/production domains.

## Deploy checklist (user)

1. Link Vercel project: `cd website && vercel link` (if not linked).
2. Set env vars in Vercel dashboard (all required vars above).
3. `bun run build` locally — must pass.
4. `vercel deploy` (preview) or push to connected Git branch.
5. Run manual OAuth checklist on preview URL.
6. Confirm security headers (`X-Content-Type-Options`, `X-Frame-Options`) on response.
7. Production cutover when preview validated.

## Related docs

- `website/AGENTS.md` — agent dev guide
- `docs/website-migration/USE-CASES.md` — UC table
- `docs/website-migration/LEGACY-API-INVENTORY.md` — endpoint matrix
- `.opencode/context/workflows/website-migration-workflow.md` — per-phase workflow
## Deploy Log

### 2026-07-01 — Preview deploy & smoke

   


| Item | Result |
|------|--------|
| Local `bun run type-check` | Pass |
| Local `bun run test` (71) | Pass |
| Local `bun run build` | Pass |
| Vercel preview URL | https://rosalita-business-review-pez9awo8h-ilishaps-projects.vercel.app (**Ready**) |
| Deploy fixes | zenstack generate in build; `.vercelignore` for legacy `api/`; removed duplicate `functions` in `vercel.json` |
| Local smoke | me 200; metrics 401; content 404 (missing seed); google redirect OK |
| Preview smoke | Blocked by Vercel SSO deployment protection |
| Manual OAuth | Pending user verification on preview |

### 2026-07-01 — Production deploy & canonical URL

| Item | Result |
|------|--------|
| Production URL | https://rosalita-business-review.vercel.app |
| Vercel project | `rosalita-business-review` (linked via `.vercel/project.json`) |
| `NEXT_PUBLIC_APP_URL` | Set in Vercel Production: `https://rosalita-business-review.vercel.app` |
| Google OAuth redirect URI | `https://rosalita-business-review.vercel.app/api/auth/callback/google` |
| Auth origin | `getOrigin()` uses canonical URL in `VERCEL_ENV=production`; preview uses request host |
| Deploy fixes | `.vercelignore` `/api/` only (was excluding `src/app/api`); production deploy `dpl_BioPxSwcWPZddDKJCbww5bUeATda` |


