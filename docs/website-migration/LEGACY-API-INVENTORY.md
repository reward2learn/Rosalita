# Legacy API Inventory — Rosalita Website

**Source:** `website/api/*.js` (read-only during migration)  
**Target:** `website/src/app/api/**/route.ts` with JWT session claims on write paths  
**Last updated:** Migration plan v2 (tri-review)

## Summary

| File | Base path | Methods | Auth (legacy) | Auth (v2 target) |
|------|-----------|---------|---------------|------------------|
| `auth.js` | `/api/auth` | GET, POST | JWT cookie / SETUP_TOKEN | JWT cookie + tier claims |
| `metrics.js` | `/api/metrics` | GET, POST, DELETE | `x-admin-key` on writes + some GET | JWT `pin` or `google` on writes |
| `financial-overview.js` | `/api/financial-overview` | GET, POST | Public read; `x-admin-key` on monthly-actuals POST | JWT tier on writes |
| `chat.js` | `/api/chat` | GET, POST | Optional session for conversations | JWT `google` for save; public chat optional |
| `pos.js` | `/api/pos` | POST | `x-admin-key` (via handlers) | JWT `pin` or `google` |
| `vjobs/status/[jobId].js` | `/api/vjobs/status/:jobId` | GET | Session in PDF job payload | JWT `google` for PDF queue |

**Vercel rewrites** (preserve in `next.config`):

| Public URL | Internal |
|------------|----------|
| `/api/auth/callback/google` | `/api/auth?action=google-callback` |
| `/api/voice` | `/api/chat?resource=voice` |
| `/api/conversations` | `/api/chat?resource=conversations` |
| `/api/reports` | `/api/financial-overview?resource=reports` |

---

## `/api/auth` — `auth.js`

| Action | Method | Query | Body | Response | Legacy auth | v2 auth |
|--------|--------|-------|------|----------|-------------|---------|
| `google` | GET | `redirect` | — | 302 → Google OAuth | None | None |
| `google-callback` | GET | `code`, `state` | — | 302 + `rosalita.session` cookie | OAuth | OAuth → JWT `google` tier |
| `me` | GET | — | — | `{ user, tier }` | Cookie JWT | Cookie JWT |
| `logout` | GET | — | — | Clear cookie | Cookie | Cookie |
| `pdf` | GET | `page` | — | `{ jobId, statusCheckUrl }` | JWT required | JWT `google` |
| `verify-pin` | POST | — | `{ pin }` | Set cookie, tier `pin` | None | None → JWT `pin` |
| `store-key` | POST | — | `{ key, value }` | Encrypted secret stored | `Authorization: Bearer SETUP_TOKEN` | Same (setup only) |

**Known gap:** `handleStoreKey` referenced in router (line 245) but **function is not defined** in legacy file — comments at lines 207–226 note removal of duplicate placeholders. **P3 fix:** `website/src/lib/auth/store-key.ts` + `src/app/api/auth/route.ts` POST handler. Auth: `Authorization: Bearer SETUP_TOKEN`; body `{ key, value }`; encrypt + upsert `secrets`.

**PDF flow:** `pdf` → `INSERT job_queue` → client polls `/api/vjobs/status/:jobId`.

---

## `/api/metrics` — `metrics.js`

**Legacy write auth:** `x-admin-key: rosalita2026` (or `METRICS_WRITE_API_KEY` env).  
**v2:** `requireWriteAuth(req)` — valid `rosalita.session` JWT with `tier ∈ { pin, google }`. No client-side admin key.

### GET

| Query | Auth | Purpose |
|-------|------|---------|
| `schema=1` | Public | Z-report form schema (sections, departments, required fields) |
| `calendar=YYYY-MM` | Admin | Month calendar for import UI |
| `detail=YYYY-MM-DD` | Admin | Single Z-report by date + `department` |
| `from`, `to`, `page`, `limit`, `export=1`, `source` | Public (list) | Paginated Z-report list; `source=pos\|xlsx` filters |

### POST

| Body shape | Purpose |
|------------|---------|
| `{ action: 'import', mode: 'daily', rows: [...] }` | Bulk XLSX/daily import |
| `{ action: 'import', mode: 'monthly_prorate', period, monthly }` | Monthly prorate import |
| Z-report fields + `receipt_images` | Upsert single Z-report (`ON CONFLICT report_date, department`) |
| `is_correction`, `correction_field`, `correction_reason` | Correction metadata |

### DELETE

| Query | Purpose |
|-------|---------|
| `period=YYYY-MM` | Delete imported rows for month |
| `report_date` / `date` | Delete single report; `scope=imported` for import-only |

**Tables:** `daily_z_reports`  
**Side effects:** `resyncActualsCascadeFrom` → `monthly_actual_*` tables

---

## `/api/financial-overview` — `financial-overview.js`

### Default GET (no `resource`)

| Query | Purpose |
|-------|---------|
| `scenario=conservative\|realistic\|aspirational` | Chart KPI series (multi-year) |
| `period=YYYY-MM` | P&L line breakdown for month (all scenarios) |

**Table:** `financial_projections` — **must preserve** `data_type` + `scenario` columns (not scenario-only).

### `?resource=monthly-actuals`

| Method | Query / body | Auth | Purpose |
|--------|--------------|------|---------|
| GET | `period`, `department`, `prefill=1` | Read: public; sensitive prefill: write tier | Department cost inputs |
| POST | `{ period, department, inputs, receipt_images, notes }` | Admin key → JWT write | Save monthly actuals |

**Tables:** `monthly_actual_inputs`, `monthly_actual_departments`

### `?resource=reports`

| Query | Purpose |
|-------|---------|
| `period=daily\|weekly\|monthly` | Aggregated metrics from `daily_z_reports` |
| `resource=targets` (nested) | `monthly_targets` rows |

---

## `/api/chat` — `chat.js`

| Resource | Method | Purpose |
|----------|--------|---------|
| (default) | POST | OpenAI chat; optional `stream`; DB context injection |
| `voice` | POST | OpenAI TTS proxy |
| `conversations` | GET, POST | List/save chat history |

**Body (chat):** `{ message, history[], stream? }`  
**Tables:** `conversations`, `secrets` (API key)  
**Static context:** `lib/knowledge-base.js` → v2 `KnowledgeSnippet` seed

---

## `/api/pos` — `pos.js`

| Action | Method | Purpose |
|--------|--------|---------|
| `scan` | POST | OCR receipt images → text |
| `parse` | POST | Parse receipt text → Z fields |
| `expense-scan` | POST | Expense receipt OCR |
| `expense-parse` | POST | Expense parse |

**v2 auth:** JWT write tier on all actions.

---

## `/api/vjobs/status/:jobId` — `vjobs/status/[jobId].js`

| Method | Purpose |
|--------|---------|
| GET | Poll PDF job; inline process if `PENDING` |

**Table:** `job_queue`  
**Returns:** `{ status, pdfBase64? }` on completion

---

## Database tables touched by API

| Table | Created by | Notes |
|-------|------------|-------|
| `secrets` | `lib/db.js` migrate | AES-256-GCM encrypted |
| `conversations` | `lib/db.js` | Chat history JSONB |
| `job_queue` | `lib/db.js` | PDF async jobs |
| `financial_projections` | `lib/db.js` | `data_type` + `scenario` UNIQUE |
| `daily_z_reports` | `lib/db.js` | Primary POS data |
| `monthly_actual_inputs` | `lib/db.js` | Consolidated inputs |
| `monthly_actual_departments` | `lib/db.js` | Per-dept inputs |
| `daily_metrics` | `schema.sql` only | Legacy; ZenStack `DailyMetric` + ensureLegacyTables in P6 seed |
| `monthly_targets` | `schema.sql` only | Legacy; ZenStack `MonthlyTarget` + seed from Executive Summary / knowledge-base |

---

## v2 route handler map

```
api/auth.js              → src/app/api/auth/route.ts
api/metrics.js           → src/app/api/metrics/route.ts
api/financial-overview.js → src/app/api/financial-overview/route.ts
api/chat.js              → src/app/api/chat/route.ts
api/pos.js               → src/app/api/pos/route.ts
api/vjobs/status/[jobId].js → src/app/api/vjobs/status/[jobId]/route.ts
```

**Shared libs (TypeScript):** `src/lib/auth/`, `src/lib/db.ts` (ZenStack `createClient`), `src/domain/**`

**Removed pattern:** Client sends `x-admin-key`. RTK Query mutations attach session cookie only; server validates JWT claims.
