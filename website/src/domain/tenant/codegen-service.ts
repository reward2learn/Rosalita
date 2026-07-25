/**
 * Code Generation Service — Phase 6
 *
 * Takes a W3C schema definition (from the AI schema generator) and produces
 * a complete tenant app codebase in a temp directory. The generated code is a
 * full Next.js 16 App Router project with:
 *
 *   - ZenStack schema.zmodel (from compileToZModel)
 *   - Page catalog (from compileToPageCatalog, enhanced with utility fns)
 *   - Block registry (maps block types → generated model block components)
 *   - Block components per model (MUI CRUD list + form dialog)
 *   - API routes per model (GET / POST / PUT / DELETE via raw SQL)
 *
 * The base template is copied from the website/ directory. Tenant config is
 * injected into vercel.json's env section so the deployed app knows its slug,
 * display name, colors, and template ID.
 */

import { mkdir, rm, cp, copyFile, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { compileToZModel, compileToPageCatalog } from '@/domain/ai/zmodel-compiler';
import type {
  SchemaGenerationResult,
  GeneratedModel,
  GeneratedField,
} from '@/domain/ai/schema-generation-schema';

// ── Config ────────────────────────────────────────────────────────

/** Root of the base Next.js template (the website/ project). */
const BASE_TEMPLATE_DIR =
  process.env.TENANT_BASE_TEMPLATE_DIR ?? join(process.cwd(), '..', 'website');

/** Temp directory root (OS-aware). */
const TMP_ROOT = process.env.TMPDIR ?? '/tmp';

/** Individual files to copy from the base template. */
const COPY_FILES = [
  'package.json',
  'next.config.mjs',
  'tsconfig.json',
  'vercel.json',
  '.gitignore',
  'src/proxy.ts',
  'src/lib/db.ts',
  'src/lib/crypto.ts',
  'src/lib/secrets.ts',
  'src/lib/openai.ts',
  'src/app/layout.tsx',
];

/** Directories to copy recursively from the base template. */
const COPY_DIRS = [
  'src/lib/auth',
  'src/lib/api',
  'src/lib/config',
  'src/lib/navigation',
  'src/theme',
  'src/store',
  'src/components/layout',
  'src/app/(app)',
  'src/app/api/auth',
];

// ── Types ─────────────────────────────────────────────────────────

export interface TenantConfig {
  slug: string;
  displayName: string;
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
}

export interface CodegenResult {
  outputDir: string;
  fileCount: number;
}

/** Re-export the model type under the name used in the task spec. */
export type SchemaModel = GeneratedModel;

// ── Helpers ───────────────────────────────────────────────────────

/** Convert PascalCase → kebab-case (e.g. "MenuItem" → "menu-item"). */
function toKebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1-$2')
    .toLowerCase();
}

/** Convert snake_case → hyphen-case for URL paths (e.g. "menu_items" → "menu-items"). */
function toHyphenCase(name: string): string {
  return name.replace(/_/g, '-');
}

// ── Main entry point ──────────────────────────────────────────────

/**
 * Generate a complete tenant app codebase in /tmp/tenant-{slug}/.
 *
 * Steps:
 *   1. Create temp directory
 *   2. Copy base template from website/
 *   3. Generate zenstack/schema.zmodel
 *   4. Generate src/lib/page-catalog.ts
 *   5. Generate src/lib/block-registry.ts
 *   6. Generate block components + API routes per model
 *   7. Patch db.ts (add createRawClient if missing)
 *   8. Inject tenant config into vercel.json
 *   9. Return { outputDir, fileCount }
 */
export async function generateTenantCode(
  slug: string,
  templateId: string,
  schema: SchemaGenerationResult,
): Promise<CodegenResult> {
  const outputDir = join(TMP_ROOT, `tenant-${slug}`);

  // 1. Clean any existing output dir and create fresh
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  let fileCount = 0;

  // 2. Copy base template
  await copyBaseTemplate(outputDir);
  fileCount += COPY_FILES.length + COPY_DIRS.length;

  // 3. Generate zenstack/schema.zmodel
  const zmodel = compileToZModel(schema);
  const zenstackDir = join(outputDir, 'zenstack');
  await mkdir(zenstackDir, { recursive: true });
  await writeFile(join(zenstackDir, 'schema.zmodel'), zmodel, 'utf8');
  fileCount++;

  // 4. Generate src/lib/page-catalog.ts
  const pageCatalog = generatePageCatalog(schema);
  const libDir = join(outputDir, 'src', 'lib');
  await mkdir(libDir, { recursive: true });
  await writeFile(join(libDir, 'page-catalog.ts'), pageCatalog, 'utf8');
  fileCount++;

  // 5. Generate src/lib/block-registry.ts
  const blockRegistry = generateBlockRegistry(schema);
  await writeFile(join(libDir, 'block-registry.ts'), blockRegistry, 'utf8');
  fileCount++;

  // 6. Generate block components + API routes for each model
  const blocksDir = join(outputDir, 'src', 'components', 'blocks');
  await mkdir(blocksDir, { recursive: true });

  for (const model of schema.models) {
    // Block component
    const blockContent = generateBlockComponent(model);
    const blockFileName = `${toKebabCase(model.name)}-block.tsx`;
    await writeFile(join(blocksDir, blockFileName), blockContent, 'utf8');
    fileCount++;

    // API route
    const apiContent = generateApiRoute(model);
    const routeSegment = toHyphenCase(model.tableName);
    const apiRouteDir = join(outputDir, 'src', 'app', 'api', routeSegment);
    await mkdir(apiRouteDir, { recursive: true });
    await writeFile(join(apiRouteDir, 'route.ts'), apiContent, 'utf8');
    fileCount++;
  }

  // 7. Patch db.ts to add createRawClient() if missing
  await patchDbTs(outputDir);
  fileCount++;

  // 8. Patch package.json (remove postinstall script that references missing files)
  await patchPackageJson(outputDir);

  // 9. Inject tenant config into vercel.json
  await injectTenantConfig(outputDir, {
    slug,
    displayName: slug.charAt(0).toUpperCase() + slug.slice(1),
    templateId,
    primaryColor: '#eb3d28',
    secondaryColor: '#0af9fe',
  });

  console.log(
    `[codegen] Generated ${fileCount} files for tenant "${slug}" in ${outputDir}`,
  );
  return { outputDir, fileCount };
}

// ── Template copying ──────────────────────────────────────────────

/**
 * Copy base template files and directories from website/ into the output dir.
 * Missing files/dirs are logged but do not throw — the generated app can
 * still function with partial template copying.
 */
export async function copyBaseTemplate(outputDir: string): Promise<void> {
  // Copy individual files
  for (const relPath of COPY_FILES) {
    const src = join(BASE_TEMPLATE_DIR, relPath);
    const dest = join(outputDir, relPath);
    if (existsSync(src)) {
      await mkdir(join(dest, '..'), { recursive: true });
      await copyFile(src, dest);
    } else {
      console.warn(`[codegen] Template file not found, skipping: ${relPath}`);
    }
  }

  // Copy directories recursively
  for (const relPath of COPY_DIRS) {
    const src = join(BASE_TEMPLATE_DIR, relPath);
    const dest = join(outputDir, relPath);
    if (existsSync(src)) {
      await mkdir(join(dest, '..'), { recursive: true });
      await cp(src, dest, { recursive: true });
    } else {
      console.warn(`[codegen] Template dir not found, skipping: ${relPath}`);
    }
  }
}

// ── Page catalog generation ───────────────────────────────────────

/**
 * Generate a complete page-catalog.ts that is drop-in compatible with the
 * original website page-catalog. Uses compileToPageCatalog() for the page
 * data, then fixes the self-import and appends utility functions.
 */
function generatePageCatalog(schema: SchemaGenerationResult): string {
  const compiled = compileToPageCatalog(schema);

  // The compiled output imports PageDefinition from '@/lib/page-catalog' (self-import).
  // Replace with inline type definitions since this file IS the page-catalog.
  const inlineTypes = `export type AuthTier = 'public' | 'pin' | 'google';

export type BlockType =
  | 'hero' | 'metric_grid' | 'chart_financial' | 'lever_accordion'
  | 'action_checklist' | 'doc_markdown' | 'pnl_table' | 'ops_admin_tabs'
  | 'z_report_form' | 'costs_form' | 'calendar_import' | 'chat_panel'
  | 'review_blocks' | 'kpi_cards' | 'reports_rollup' | 'sheet_viewer'
  | 'dynamic_form';

export interface PageSectionDefinition {
  blockType: BlockType;
  config: Record<string, unknown>;
}

export interface PageDefinition {
  slug: string;
  title: string;
  authTier: AuthTier;
  navLabel?: string;
  showInNav?: boolean;
  pdfExport?: boolean;
  sections: PageSectionDefinition[];
}`;

  const fixed = compiled.replace(
    /import type \{ PageDefinition \} from '@\/lib\/page-catalog';/,
    inlineTypes,
  );

  // Append the catalog record and utility functions
  return (
    fixed +
    `
// ── Catalog record ────────────────────────────────────────────

export const PAGE_CATALOG: Record<string, PageDefinition> = Object.fromEntries(
  GENERATED_PAGES.map((p) => [p.slug, p]),
);

// ── Utility functions ─────────────────────────────────────────

const TIER_RANK: Record<AuthTier, number> = {
  public: 0,
  pin: 1,
  google: 2,
};

export function tierAllowsAccess(current: AuthTier, required: AuthTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export function resolvePage(slug: string): PageDefinition | null {
  return PAGE_CATALOG[slug] ?? null;
}

export function listNavPages(tier: AuthTier): PageDefinition[] {
  return Object.values(PAGE_CATALOG)
    .filter((p) => p.showInNav !== false)
    .filter((p) => tierAllowsAccess(tier, p.authTier))
    .sort((a, b) => a.title.localeCompare(b.title));
}
`
  );
}

// ── Block registry generation ─────────────────────────────────────

/**
 * Generate a block-registry.ts that maps block types to components.
 * Standard block types (hero, kpi_cards, etc.) use stub components.
 * Model-specific blocks use the generated CRUD components.
 */
function generateBlockRegistry(schema: SchemaGenerationResult): string {
  const modelImports = schema.models
    .map(
      (m) =>
        `import { ${m.name}Block } from '@/components/blocks/${toKebabCase(m.name)}-block';`,
    )
    .join('\n');

  const modelEntries = schema.models
    .map((m) => `  ${m.name.toLowerCase()}: ${m.name}Block,`)
    .join('\n');

  return `'use client';
import type { ComponentType } from 'react';
${modelImports}

type BlockComponent = ComponentType<{ config: Record<string, unknown> }>;

/** Stub for standard block types whose components are not bundled. */
const StubBlock: BlockComponent = ({ config }) => (
  <div style={{ padding: 24, color: '#888' }}>
    {String(config.label ?? 'Block placeholder')}
  </div>
);

export const BLOCK_REGISTRY: Record<string, BlockComponent> = {
  hero: StubBlock,
  kpi_cards: StubBlock,
  metric_grid: StubBlock,
  chart_financial: StubBlock,
  lever_accordion: StubBlock,
  action_checklist: StubBlock,
  doc_markdown: StubBlock,
  pnl_table: StubBlock,
  ops_admin_tabs: StubBlock,
  z_report_form: StubBlock,
  costs_form: StubBlock,
  calendar_import: StubBlock,
  chat_panel: StubBlock,
  review_blocks: StubBlock,
  reports_rollup: StubBlock,
  sheet_viewer: StubBlock,
  dynamic_form: StubBlock,
${modelEntries}
};

export function getBlockComponent(blockType: string): BlockComponent {
  return BLOCK_REGISTRY[blockType] ?? StubBlock;
}
`;
}

// ── Block component generation ────────────────────────────────────

/**
 * Generate a React component string for a model's CRUD block.
 * Renders a MUI Table of records and a dialog form for creating new ones.
 */
export function generateBlockComponent(model: GeneratedModel): string {
  const modelName = model.name;
  const componentName = `${modelName}Block`;
  const apiPath = `/api/${toHyphenCase(model.tableName)}`;

  const fieldsStr = model.fields
    .map(
      (f) =>
        `  { name: ${JSON.stringify(f.name)}, label: ${JSON.stringify(f.label ?? f.name)}, type: ${JSON.stringify(f.type)}, width: ${f.width ?? 12} }`,
    )
    .join(',\n    ');

  return `'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Paper, Button, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, Grid2 as Grid,
} from '@mui/material';

const MODEL_NAME = ${JSON.stringify(modelName)};
const API_PATH = ${JSON.stringify(apiPath)};
const FIELDS: Array<{ name: string; label: string; type: string; width: number }> = [
  ${fieldsStr}
];

export function ${componentName}({ config }: { config: Record<string, unknown> }) {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const loadRecords = useCallback(async () => {
    try {
      const res = await fetch(API_PATH);
      const data = await res.json();
      setRecords(data.data?.items ?? []);
    } catch (err) {
      console.error('[${componentName}] Failed to load:', err);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleChange = (name: string, value: string) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      await fetch(API_PATH, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setOpen(false);
      setForm({});
      await loadRecords();
    } catch (err) {
      console.error('[${componentName}] Failed to save:', err);
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h5">{MODEL_NAME}</Typography>
        <Button variant="contained" color="primary" onClick={() => setOpen(true)}>
          Add New
        </Button>
      </Box>
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              {FIELDS.map((f) => (
                <TableCell key={f.name}>{f.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={FIELDS.length} align="center">
                  No records found
                </TableCell>
              </TableRow>
            ) : (
              records.map((row, i) => (
                <TableRow key={(row.id as string) ?? i}>
                  {FIELDS.map((f) => (
                    <TableCell key={f.name}>
                      {String(row[f.name] ?? '')}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Add {MODEL_NAME}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {FIELDS.map((f) => (
              <Grid size={{ xs: 12, md: f.width }} key={f.name}>
                <TextField
                  label={f.label}
                  name={f.name}
                  fullWidth
                  multiline={f.type === 'text'}
                  rows={f.type === 'text' ? 3 : undefined}
                  value={String(form[f.name] ?? '')}
                  onChange={(e) => handleChange(f.name, e.target.value)}
                />
              </Grid>
            ))}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
`;
}

// ── API route generation ──────────────────────────────────────────

/**
 * Generate a Next.js route handler string for a model's CRUD API.
 * Uses createRawClient() and parameterized raw SQL for all operations.
 *
 *   GET    /api/{table}           — list records (optional ?tenantSlug=)
 *   POST   /api/{table}           — create a record
 *   PUT    /api/{table}?id=xxx    — update a record by id
 *   DELETE /api/{table}?id=xxx    — delete a record by id
 */
export function generateApiRoute(model: GeneratedModel): string {
  const tableName = model.tableName;
  const fieldNames = model.fields.map((f) => f.name);
  const fieldsArrayStr = JSON.stringify(fieldNames);

  return `import { NextResponse } from 'next/server';
import { createRawClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonOk, jsonError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

const TABLE = ${JSON.stringify(tableName)};
const FIELDS = ${fieldsArrayStr} as const;

// GET — list records (optional ?tenantSlug= filter)
export async function GET(request: Request): Promise<NextResponse> {
  const db = createRawClient() as any;
  try {
    const tenantSlug = new URL(request.url).searchParams.get('tenantSlug');
    const rows = tenantSlug
      ? await db.$queryRawUnsafe(
          \`SELECT * FROM "\${TABLE}" WHERE "tenant_slug" = $1 ORDER BY "created_at" DESC LIMIT 100\`,
          tenantSlug,
        )
      : await db.$queryRawUnsafe(
          \`SELECT * FROM "\${TABLE}" ORDER BY "created_at" DESC LIMIT 100\`,
        );
    return jsonOk({ items: rows });
  } catch (err) {
    console.error(\`[api/\${TABLE}] GET error:\`, err);
    return jsonError('Failed to list records', 500);
  }
}

// POST — create a new record
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const db = createRawClient() as any;
  const columns: string[] = [];
  const values: unknown[] = [];

  for (const field of FIELDS) {
    if (body[field] !== undefined) {
      columns.push(\`"\${field}"\`);
      values.push(body[field]);
    }
  }

  if (columns.length === 0) {
    return jsonError('No valid fields provided', 400);
  }

  const placeholders = values.map((_, i) => \`$\${i + 1}\`).join(', ');

  try {
    const result = await db.$queryRawUnsafe(
      \`INSERT INTO "\${TABLE}" (\${columns.join(', ')}) VALUES (\${placeholders}) RETURNING *\`,
      ...values,
    );
    return jsonOk({ item: (result as unknown[])[0] });
  } catch (err) {
    console.error(\`[api/\${TABLE}] POST error:\`, err);
    return jsonError('Failed to create record', 500);
  }
}

// PUT — update a record by id (?id=xxx)
export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return jsonError('Missing id parameter', 400);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const db = createRawClient() as any;
  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const field of FIELDS) {
    if (body[field] !== undefined) {
      values.push(body[field]);
      setClauses.push(\`"\${field}" = $\${values.length}\`);
    }
  }

  if (setClauses.length === 0) {
    return jsonError('No valid fields to update', 400);
  }

  values.push(id);
  const idPlaceholder = \`$\${values.length}\`;

  try {
    const result = await db.$queryRawUnsafe(
      \`UPDATE "\${TABLE}" SET \${setClauses.join(', ')}, "updated_at" = CURRENT_TIMESTAMP WHERE "id" = \${idPlaceholder} RETURNING *\`,
      ...values,
    );
    return jsonOk({ item: (result as unknown[])[0] });
  } catch (err) {
    console.error(\`[api/\${TABLE}] PUT error:\`, err);
    return jsonError('Failed to update record', 500);
  }
}

// DELETE — remove a record by id (?id=xxx)
export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const id = new URL(request.url).searchParams.get('id');
  if (!id) return jsonError('Missing id parameter', 400);

  const db = createRawClient() as any;

  try {
    await db.$executeRawUnsafe(
      \`DELETE FROM "\${TABLE}" WHERE "id" = $1\`,
      id,
    );
    return jsonOk({ deleted: true, id });
  } catch (err) {
    console.error(\`[api/\${TABLE}] DELETE error:\`, err);
    return jsonError('Failed to delete record', 500);
  }
}
`;
}

// ── DB patch ──────────────────────────────────────────────────────

/**
 * Patch the copied db.ts to add createRawClient() if it doesn't already
 * export one. The website's db.ts has a private getBasePrisma() — we add a
 * public wrapper so generated API routes can use raw SQL without ZenStack
 * policy enhancement.
 */
async function patchDbTs(outputDir: string): Promise<void> {
  const dbPath = join(outputDir, 'src', 'lib', 'db.ts');
  if (!existsSync(dbPath)) {
    console.warn('[codegen] db.ts not found in template, skipping patch');
    return;
  }

  const content = await readFile(dbPath, 'utf8');

  // Already has createRawClient — no patch needed
  if (content.includes('export function createRawClient')) {
    return;
  }

  // Append createRawClient() that wraps the existing getBasePrisma()
  const appendCode = `

/** Raw Prisma client without ZenStack enhancement — for direct SQL CRUD.
 *  Generated by codegen-service. */
export function createRawClient() {
  return getBasePrisma();
}
`;

  await writeFile(dbPath, content + appendCode, 'utf8');
  console.log('[codegen] Patched db.ts with createRawClient()');
}

// ── Package.json patch ────────────────────────────────────────────

/**
 * Patch the copied package.json to remove the postinstall script that
 * references files not present in the generated tenant app.
 */
async function patchPackageJson(outputDir: string): Promise<void> {
  const pkgPath = join(outputDir, 'package.json');
  if (!existsSync(pkgPath)) return;

  const content = await readFile(pkgPath, 'utf8');
  const pkg = JSON.parse(content);

  if (pkg.scripts?.postinstall) {
    delete pkg.scripts.postinstall;
    await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
    console.log('[codegen] Removed postinstall script from package.json');
  }
}

// ── Tenant config injection ───────────────────────────────────────

/**
 * Inject tenant config (slug, displayName, templateId, colors) into the
 * vercel.json env section. Also sets NEXT_PUBLIC_APP_URL for the tenant's
 * Vercel subdomain.
 */
export async function injectTenantConfig(
  outputDir: string,
  config: TenantConfig,
): Promise<void> {
  const vercelJsonPath = join(outputDir, 'vercel.json');
  if (!existsSync(vercelJsonPath)) {
    console.warn('[codegen] vercel.json not found, skipping config injection');
    return;
  }

  const content = await readFile(vercelJsonPath, 'utf8');
  const vercelConfig = JSON.parse(content) as Record<string, unknown>;

  const appUrl = `https://${config.slug}.vercel.app`;

  vercelConfig.env = {
    ...(vercelConfig.env ?? {}),
    AWS_LAMBDA_JS_RUNTIME: 'nodejs22.x',
    NEXT_PUBLIC_TENANT_SLUG: config.slug,
    NEXT_PUBLIC_TENANT_DISPLAY_NAME: config.displayName,
    NEXT_PUBLIC_TENANT_DESCRIPTION: `${config.displayName} — Business Operations Dashboard`,
    NEXT_PUBLIC_TENANT_APP_TITLE: config.displayName,
    NEXT_PUBLIC_APP_URL: appUrl,
    NEXT_PUBLIC_TENANT_PRIMARY_COLOR: config.primaryColor,
    NEXT_PUBLIC_TENANT_SECONDARY_COLOR: config.secondaryColor,
    NEXT_PUBLIC_TENANT_TEMPLATE_ID: config.templateId,
  };

  await writeFile(vercelJsonPath, JSON.stringify(vercelConfig, null, 2) + '\n', 'utf8');
  console.log(`[codegen] Injected tenant config for "${config.slug}" into vercel.json`);
}

// ── Cleanup ───────────────────────────────────────────────────────

/**
 * Remove the temp directory and all generated files.
 * Called after a successful deploy or on pipeline failure.
 */
export async function cleanupTenantCode(outputDir: string): Promise<void> {
  await rm(outputDir, { recursive: true, force: true });
  console.log(`[codegen] Cleaned up ${outputDir}`);
}
