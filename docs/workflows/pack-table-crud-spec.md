# Pack Table CRUD — API + Block Specification

**Status**: Draft for implementation · **Owner**: Project Manager (Rosalita / TokenizMyApp)
**Related**: `workflows/app-pack-generate` (App Pack workflow), `src/domain/app-pack/*`, `src/lib/page-catalog.ts`, `src/lib/block-registry.ts`

---

## 1. Goal

Give every App Pack model a **runtime CRUD surface** without redeploying the tenant app.

The App Pack workflow already applies pack models to the tenant DB as real tables via additive DDL
(`applyPackSchema` in `src/domain/app-pack/app-pack-schema-apply.ts`) and materializes pages/nav/snippets
into `app_pages` / `page_sections` / `navigation_items` / `knowledge_snippets` / `security_groups`
(`materializeAppPack`). What is missing: a **generic, schema-driven table API** that reads/writes those
pack tables, and a **block component** that renders them.

This is the deliberate **option (c)** architecture: pack models live in the tenant DB; the shared app
reads them at runtime. No codegen, no Vercel redeploy.

---

## 2. The pack-table contract

A table is a **pack table** if and only if it has the exact signature `applyPackSchema` creates:

| Column | Type | Notes |
|--------|------|-------|
| `id` | `TEXT PRIMARY KEY` | Row identity; client MAY supply (deterministic ids), server generates `crypto.randomUUID()` otherwise |
| `tenant_slug` | `TEXT` | Always set server-side from `NEXT_PUBLIC_TENANT_SLUG`; never trusted from client |
| `<field>` | per model | Mapped per the table below |
| `created_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | Server-managed |
| `updated_at` | `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` | Server-set to `NOW()` on update |

### Field type mapping (mirrors `mapSqlType` / `compileToZModel`)

| zmodel type | SQL column | JS/JSON type | Coercion |
|-------------|-----------|--------------|----------|
| `string` / `text` | `TEXT` | `string` | as-is |
| `integer` | `INTEGER` | `number` | `Number(v)`; reject non-finite |
| `decimal` | `NUMERIC(14,2)` | `number` | **pg returns NUMERIC as string → `parseFloat`** |
| `boolean` | `BOOLEAN` | `boolean` | accept `true/false` (JSON) |
| `datetime` | `TIMESTAMP` | ISO string | pass-through (validate `Date.parse`) |
| `date` | `DATE` | ISO string | pass-through |
| `time` | `TIME` | string | pass-through |
| `enum` | `TEXT` | `string` | as-is (no DB constraint) |
| `json` | `JSONB` | object | `JSON.stringify` on write; pg returns parsed object on read |
| `relation` | `TEXT` | `string` | as-is (stores id reference) |

---

## 3. API surface

Base path: `/api/pack-tables`. Next.js 16 dynamic route params (`params: Promise<{...}>`).
All responses use the standard envelope: `jsonOk` → `{ success: true, data }`, `jsonError` → `{ success: false, error }`.

### 3.1 `GET /api/pack-tables/[table]` — list rows

Query params:
- `page` — 1-based, default 1
- `perPage` — default 50, **capped at 500**
- `sortBy` — JSON array of `[column, 'asc'|'desc']` pairs, **validated against table metadata** (max 3 pairs)
- `q` — free-text search; applied as `ILIKE '%q%'` on every text column (`TEXT`-typed), escaped

Response `data`:
```json
{
  "table": "reservations",
  "rows": [{ "id": "…", "tenant_slug": "…", "guest": "…", "created_at": "…" }],
  "totalRows": 42,
  "page": 1,
  "perPage": 50,
  "totalPages": 1
}
```

SQL: `SELECT * FROM "tbl" WHERE tenant_slug = $1 [AND (col ILIKE $2 …)] ORDER BY … LIMIT … OFFSET …` +
a `COUNT(*)` for `totalRows`. All values parameterized; identifiers quoted with double-quote escaping.

### 3.2 `GET /api/pack-tables/[table]/meta` — column metadata

Response `data`:
```json
{
  "table": "reservations",
  "columns": [
    { "name": "id", "dataType": "TEXT", "isPrimary": true, "required": true, "unique": false, "isBase": true, "editable": false },
    { "name": "guest", "dataType": "TEXT", "isPrimary": false, "required": false, "unique": false, "isBase": false, "editable": true }
  ],
  "writableColumns": ["guest", "party_size", "notes"]
}
```

Source: `information_schema.columns` (table filtered by the signature check).
`editable: false` for `id`, `tenant_slug`, `created_at`, `updated_at`.

### 3.3 `POST /api/pack-tables/[table]` — create row

Body: `{ "data": { …field values… } }` (flat JSON object; `id` optional).

Rules:
- Keys validated against metadata → unknown columns rejected (422).
- `tenant_slug` = `process.env.NEXT_PUBLIC_TENANT_SLUG` (server-set, overrides any client value).
- `created_at` / `updated_at` never accepted from client.
- `id` accepted if present (validated as non-empty string ≤ 64 chars), else `crypto.randomUUID()`.
- Required (`NOT NULL`, no default) columns missing → 422 listing them.

Response `data`: the created row.

### 3.4 `PATCH /api/pack-tables/[table]/[id]` — update row

Body: `{ "data": { …fields to update… } }` — partial update; same column validation; `updated_at = NOW()`.
404 if row id not found (scoped to tenant).

### 3.5 `DELETE /api/pack-tables/[table]/[id]` — delete row

204 on success (or `jsonOk({ deleted: true })`); 404 if not found.

---

## 4. Validation & security (defense in depth)

1. **Identifier regex**: table & column names must match `^[a-z_][a-z0-9_]{0,63}$` — reject otherwise (400).
2. **System blocklist** (never exposed, even if signature matches): `app_pages`, `page_sections`,
   `navigation_items`, `knowledge_snippets`, `security_groups`, `tenants`, `users`, `sessions`,
   `workflow_runs`, `jobs`.
3. **Pack-signature check**: table must exist in `information_schema.columns` AND have `id` (PK),
   `tenant_slug`, `created_at`, `updated_at` columns. Fails → 404 ("not a pack table"). This is what
   excludes most system tables and any accidental table.
4. **SQL injection**: identifiers only after regex + metadata lookup (never interpolated raw);
   all values via parameterized queries. `ILIKE` pattern escapes `%`/`_`/`\`.
5. **Auth**: `GET` (list + meta) → `requireSession`. `POST`/`PATCH`/`DELETE` → `requireWriteAuth`.
   Page/nav-level group gating already handled by the dynamic page router (`required_groups`);
   the API trusts session tier only.
6. **Tenant scoping**: every read filters `WHERE tenant_slug = $envSlug` and every write sets it.
   In per-tenant Neon branches this is redundant defense; in root-DB fallback deployments it is the
   actual isolation boundary.
7. **DoS guardrails**: `perPage ≤ 500`, `page ≤ 10000`, `q ≤ 200` chars, max 3 sort pairs.

---

## 5. Block component — `pack-table-block.tsx`

Location: `src/components/blocks/pack-table-block.tsx` (`'use client'`). Registered as `pack_table`.

### Config (zod: `packTableConfigSchema`)

```ts
{
  table: z.string(),                    // REQUIRED — model.tableName
  title: z.string().optional(),
  pageSize: z.number().min(1).max(500).optional(),  // default 50
  readonly: z.boolean().optional(),     // hides add/edit/delete
  columns: z.array(z.string()).optional(), // subset + display order (default: writable + id)
  minTier: z.enum(['public','pin','google']).optional(),
}
```

Missing `table` → render a friendly empty state ("Configure a pack table for this block").

### Behavior

- **Grid**: MUI `DataGrid` (same dynamic-import pattern as `sheet-viewer-block.tsx`; community edition —
  server-side pagination + sort, no selection-pane complexity).
- **Data**: `useGetPackTableRowsQuery` + `useGetPackTableMetaQuery` (RTK Query; store file below).
  Server-side `sortBy` serialized like sheet-viewer; `q` search box debounced (300ms).
- **Columns**: built from `/meta`; type-driven:
  - `boolean` → `Checkbox` render + edit
  - `integer`/`decimal` → right-aligned number
  - `datetime`/`date`/`time` → string with ISO placeholder
  - `json` → monospace cell, JSON-validated edit dialog
  - `text`/`enum`/`relation` → text cell; `text` editable inline (or dialog for long values)
  - base columns (`id`, `tenant_slug`, `created_at`, `updated_at`) → hidden or read-only (show `id`
    and timestamps read-only; hide `tenant_slug`).
- **Toolbar**: search box; `+ Add` button (dialog with per-type inputs); `Refresh`.
- **Edit**: inline `processRowUpdate` → PATCH (revert + snackbar on error), or row-action edit dialog
  (preferred v1: dialog — simpler than the formula editor machinery).
- **Delete**: row action → confirm dialog → DELETE → `refetch()` + snackbar.
- **Empty state**: "No rows yet — add the first record."
- **Errors**: snackbar with API `error` message; grid keeps old rows on failure.

### Store — `src/store/apis/pack-table-api.ts`

RTK Query endpoints (pattern of `sheet-data-api.ts`), tag `'PackTable'`:
- `getPackTableRows({ table, page, perPage, sortBy, q })` → `{ rows, totalRows, page, perPage, totalPages }`
- `getPackTableMeta(table)` → `{ columns, writableColumns }`
- `createPackTableRow({ table, data })`
- `updatePackTableRow({ table, id, data })`
- `deletePackTableRow({ table, id })`
- Mutations invalidate `['PackTable']`.

---

## 6. Wiring checklist (files touched, in implementation order)

1. **`src/lib/pack-table.ts`** (new) — core library: identifier validation, system blocklist,
   signature check query, `information_schema` metadata fetch, type map + coercion
   (NUMERIC string → number, JSONB parse/stringify, boolean), query builders
   (`buildListQuery`, `buildWhere`, `buildInsert`, `buildUpdate`), zod schemas for query/body,
   `NEXT_PUBLIC_TENANT_SLUG` resolution.
2. **`src/app/api/pack-tables/[table]/route.ts`** (new) — GET list + POST create.
3. **`src/app/api/pack-tables/[table]/meta/route.ts`** (new) — GET metadata.
4. **`src/app/api/pack-tables/[table]/[id]/route.ts`** (new) — PATCH + DELETE.
5. **`src/lib/page-catalog.ts`** — add `'pack_table'` to the `BlockType` union (line ~10).
6. **`src/lib/schemas/block-config.ts`** — add `packTableConfigSchema` + register in `blockConfigSchemas`.
7. **`src/components/blocks/pack-table-block.tsx`** (new) — block component (§5).
8. **`src/lib/block-registry.ts`** — import + register `PackTableBlock`.
9. **`src/domain/app-pack/app-pack-compiler.ts`** — deterministic model CRUD pages (§7).
10. **`src/domain/app-pack/app-pack-materializer.ts`** — add `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'pack_table'` to `APP_PACK_ENUM_DDL`.
11. **`src/store/apis/pack-table-api.ts`** (new) — RTK Query endpoints (§5).
12. **Tests** — `src/lib/pack-table.test.ts` + compiler test (§8).

---

## 7. Compiler integration — every model gets a CRUD page

In `compileAppRows` (`app-pack-compiler.ts`), after mapping AI pages, **deterministically append**
one page per model (AI page choices never block CRUD access):

- page id: `page_${packId}_${def.appId}_model_${model.tableName}`
- slug: `${packId}-${def.appId}-${model.tableName}` (flat, unique — matches `app_pages.slug` UNIQUE)
- title: humanized `model.name` (e.g. `Reservation` → `Reservations` when model name pluralizes; else keep `model.name`)
- sections: `[{ blockType: 'pack_table', config: { table: model.tableName, title: model.name } }]`
- nav child: `nav_${packId}_${def.appId}_model_${model.tableName}`, path `/<slug>`,
  `requiredGroups: app_${def.appId}`, `isDynamic: true`, sort order after AI pages.

Notes:
- Works for CEO def too — the materializer's CEO path already uses `rows.pages.slice(1)` and iterates
  `rows.nav` for the CEO def, so appended pages/nav flow through unchanged.
- AI-generated pages may additionally reference `pack_table` in `blockTypes`; those sections get
  `config: {}` (block renders the "configure a table" empty state). A future enhancement: let the
  generator emit per-block configs (`p.blockConfigs[bt]`).

---

## 8. Tests

Vitest, colocated (repo convention: `*.test.ts` next to source):

- **`src/lib/pack-table.test.ts`**
  - identifier regex: accepts `reservations`, `order_items_2`; rejects `Orders`, `a-b`, `"tbl"`, `a; DROP`
  - blocklist rejects `navigation_items`, `app_pages`, …
  - signature check SQL returns true only for the pack column set
  - coercion: NUMERIC string → number, JSONB round-trip, boolean strictness, date pass-through
  - sort pair validation rejects unknown columns; ILIKE escaping (`%`, `_`, `\`)
  - pagination caps (perPage 600 → 500)
- **Compiler test** — `compileAppRows` output: for each model exactly one appended page + one nav row,
  section `blockType === 'pack_table'`, `config.table === model.tableName`; slugs flat + unique.
- **API tests** (optional, integration): create → list → patch → delete round-trip against a test table.

---

## 9. Out of scope (future)

- AI-generated per-block configs (`blockConfigs` in `AppPackAppDefinition`).
- Per-field enum option lists surfaced in editors (stored as TEXT — no DB constraint).
- Formula / computed-column support for pack tables (would require a value evaluator like `excel-formula.ts`).
- Batch row operations (import CSV, multi-delete) — v2.
- Row-level security beyond `tenant_slug` scoping.

---

## 10. Acceptance criteria

1. Running the App Pack workflow on a tenant produces one CRUD page + nav entry per model, reachable
   in the deployed tenant app without any codegen or redeploy.
2. `GET/POST/PATCH/DELETE` round-trip works on any pack table; unknown tables, system tables, and
   invalid identifiers return the documented errors; writes are tenant-scoped.
3. The block renders columns with type-appropriate editors, server pagination/sort/search, add/edit/
   delete flows, and snackbar error handling.
4. `bun run typecheck` / lint / vitest pass in `tokenizmyapp` (or the shared `website/` source tree).
