import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PrismaClient,
  type ActionPriority,
  type AuthTier,
  type BlockType,
  type Prisma,
  type TaskStatus,
} from '@/generated/prisma';
import { getFullCatalog, PAGE_CATALOG, REVIEW_PART_CATALOG } from '@/lib/page-catalog';
import type { DbClient } from '@/lib/db';
import { PERSONS } from '@/domain/security/persons';
import { parseBusinessReviewParts } from '@/lib/parse-business-review';
import {
  parseFinancialProjectionsFromBuffer,
  type FinancialProjectionRow,
} from '@/domain/seed/financial-excel';
import {
  getSourceDir,
  getWebsiteRoot,
  PRIVACY_HTML_PATH,
  readSourceFile,
  readSourceText,
  sourceFileExists,
  TERMS_HTML_PATH,
  writeSourceFile,
  type SourceFileKey,
} from '@/domain/seed/source-files';
import {
  BUSINESS_NAME,
  CURRENT_METRICS,
  FIVE_LEVERS,
  KEY_RISKS,
  LOCATION,
  MONTHLY_TARGETS,
  PRIORITY_ACTIONS,
  SITUATION_SUMMARY,
  STRATEGIC_PARTNERSHIPS,
  TARGET_METRICS,
  TASK_PLAYBOOK,
} from '../../../lib/knowledge-base.js';
import {
  analyzeWorkbook,
  generatePagesFromAnalysis,
  generateAnalysisMarkdown,
  generateSheetMarkdown,
} from '@/domain/excel/workbook-analyzer';
import { setDynamicPages, setDynamicReviewParts } from '@/lib/page-catalog';
import type { ReviewPartDefinition } from '@/lib/page-catalog';

export interface SeedCounts {
  financialProjections: number;
  businessReviewParts: number;
  levers: number;
  actionItems: number;
  monthlyTargets: number;
  knowledgeSnippets: number;
  appPages: number;
  pageSections: number;
  roles: number;
  tasks: number;
  taskAssignments: number;
}

export interface SeedSourceOverrides {
  /** Single or multiple workbook buffers (uploaded XLSX files). */
  excel?: Buffer | Buffer[];
  businessReview?: string;
  executiveSummary?: string;
}

export interface SeedOptions {
  dryRun?: boolean;
  /** In-memory overrides from upload (takes precedence over disk). */
  overrides?: SeedSourceOverrides;
  /** When true, persist overrides to the configured source directory. */
  persistOverrides?: boolean;
  sourceDir?: string;
}

export interface SeedResult {
  counts: SeedCounts;
  filesUsed: Record<SourceFileKey, 'upload' | 'disk'>;
}

const DAILY_METRICS_DDL = `
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  revenue NUMERIC(12,2) NOT NULL DEFAULT 0,
  guests_count INTEGER NOT NULL DEFAULT 0,
  avg_spend NUMERIC(10,2),
  staff_count INTEGER NOT NULL DEFAULT 0,
  staff_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  food_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  beverage_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  gofood_revenue NUMERIC(12,2) DEFAULT 0,
  direct_orders NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`;

const MONTHLY_TARGETS_DDL = `
CREATE TABLE IF NOT EXISTS monthly_targets (
  id SERIAL PRIMARY KEY,
  month TEXT NOT NULL UNIQUE,
  target_revenue NUMERIC(12,2) NOT NULL,
  target_ebitda NUMERIC(12,2) NOT NULL,
  target_guests INTEGER NOT NULL,
  target_avg_spend NUMERIC(10,2) NOT NULL,
  target_staff_cost_pct NUMERIC(5,2) NOT NULL
);`;

const CONTENT_ENUM_STATEMENTS = [
  `DO $$ BEGIN CREATE TYPE "AuthTier" AS ENUM ('public', 'pin', 'google'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "ActionPriority" AS ENUM ('P0', 'P1', 'P2'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'submitted', 'completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
  `DO $$ BEGIN CREATE TYPE "BlockType" AS ENUM ('hero', 'metric_grid', 'chart_financial', 'lever_accordion', 'action_checklist', 'doc_markdown', 'pnl_table', 'z_report_form', 'costs_form', 'calendar_import', 'chat_panel', 'kpi_cards', 'ops_admin_tabs', 'review_blocks', 'reports_rollup', 'sheet_viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const BLOCK_TYPE_ALTER_STATEMENTS = [
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'ops_admin_tabs'`,
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'review_blocks'`,
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'reports_rollup'`,
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'sheet_viewer'`,
];

const CONTENT_TABLE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS app_pages (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    auth_tier "AuthTier" NOT NULL DEFAULT 'public',
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS page_sections (
    id TEXT PRIMARY KEY,
    page_id TEXT NOT NULL REFERENCES app_pages(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL,
    block_type "BlockType" NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'
  )`,
  `CREATE INDEX IF NOT EXISTS page_sections_page_id_sort_order_idx ON page_sections(page_id, sort_order)`,
  `CREATE TABLE IF NOT EXISTS business_review_parts (
    id TEXT PRIMARY KEY,
    part_key TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    sort_order INTEGER NOT NULL,
    auth_tier "AuthTier" NOT NULL DEFAULT 'google',
    markdown TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS levers (
    id TEXT PRIMARY KEY,
    num INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    impact TEXT NOT NULL,
    description TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS action_items (
    id TEXT PRIMARY KEY,
    priority "ActionPriority" NOT NULL,
    label TEXT NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT false,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS knowledge_snippets (
    id TEXT PRIMARY KEY,
    key TEXT NOT NULL UNIQUE,
    content TEXT NOT NULL,
    category TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS google_oauth_config (
    id TEXT PRIMARY KEY DEFAULT 'default',
    client_id TEXT NOT NULL,
    project_id TEXT NOT NULL,
    auth_uri TEXT NOT NULL,
    token_uri TEXT NOT NULL DEFAULT 'https://oauth2.googleapis.com/token',
    encrypted_secret TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS roles (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT UNIQUE,
    is_platform_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    priority "ActionPriority" NOT NULL DEFAULT 'P0',
    status "TaskStatus" NOT NULL DEFAULT 'pending',
    due_date TIMESTAMPTZ,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS task_assignments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned BOOLEAN NOT NULL DEFAULT true,
    UNIQUE (task_id, role_id)
  )`,
  `CREATE INDEX IF NOT EXISTS task_assignments_role_id_idx ON task_assignments(role_id)`,
];

function loadEnvLocal(): void {
  const envPath = resolve(getWebsiteRoot(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

function readUtf8(path: string): string {
  if (!existsSync(path)) {
    throw new Error(`Missing source file: ${path}`);
  }
  return readFileSync(path, 'utf8');
}

function htmlToMarkdownish(html: string): string {
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, '- $1\n')
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function buildKnowledgeSnippets(
  executiveSummaryMd: string,
  termsMd: string,
  privacyMd: string,
): { key: string; category: string; content: string }[] {
  return [
    { key: 'business_name', category: 'meta', content: BUSINESS_NAME },
    { key: 'location', category: 'meta', content: LOCATION },
    { key: 'situation_summary', category: 'overview', content: SITUATION_SUMMARY.trim() },
    {
      key: 'current_metrics',
      category: 'metrics',
      content: JSON.stringify(CURRENT_METRICS, null, 2),
    },
    {
      key: 'target_metrics',
      category: 'metrics',
      content: JSON.stringify(TARGET_METRICS, null, 2),
    },
    {
      key: 'five_levers',
      category: 'strategy',
      content: FIVE_LEVERS.map(
        (l) =>
          `${l.num}. ${l.name} — ${l.impact}\nTarget: ${l.target}\nActions:\n${l.actions.map((a) => `  - ${a}`).join('\n')}`,
      ).join('\n\n'),
    },
    {
      key: 'priority_actions_p0',
      category: 'actions',
      content: PRIORITY_ACTIONS.P0_THIS_WEEK.map((a) => `- ${a}`).join('\n'),
    },
    {
      key: 'priority_actions_p1',
      category: 'actions',
      content: PRIORITY_ACTIONS.P1_THIS_MONTH.map((a) => `- ${a}`).join('\n'),
    },
    {
      key: 'priority_actions_p2',
      category: 'actions',
      content: PRIORITY_ACTIONS.P2_THIS_QUARTER.map((a) => `- ${a}`).join('\n'),
    },
    {
      key: 'key_risks',
      category: 'risks',
      content: KEY_RISKS.map((r) => `- ${r}`).join('\n'),
    },
    {
      key: 'strategic_partnerships',
      category: 'strategy',
      content: Object.values(STRATEGIC_PARTNERSHIPS)
        .map((p) => `${p.name} (${p.type}): ${p.opportunity} — ${p.revenue_impact}`)
        .join('\n'),
    },
    {
      key: 'monthly_targets_table',
      category: 'metrics',
      content: MONTHLY_TARGETS.map(
        (t) =>
          `${t.month}: revenue ${t.revenue}, ebitda ${t.ebitda}, guests ${t.guests}/day, spend ${t.spend}, staff ${t.staffPct}%`,
      ).join('\n'),
    },
    { key: 'executive_summary', category: 'document', content: executiveSummaryMd.trim() },
    { key: 'terms_of_service', category: 'document', content: termsMd },
    { key: 'privacy_policy', category: 'document', content: privacyMd },
  ];
}

function buildActionItems(): { priority: ActionPriority; label: string; sortOrder: number }[] {
  const items: { priority: ActionPriority; label: string; sortOrder: number }[] = [];
  let order = 0;
  for (const label of PRIORITY_ACTIONS.P0_THIS_WEEK) {
    items.push({ priority: 'P0', label, sortOrder: order++ });
  }
  for (const label of PRIORITY_ACTIONS.P1_THIS_MONTH) {
    items.push({ priority: 'P1', label, sortOrder: order++ });
  }
  for (const label of PRIORITY_ACTIONS.P2_THIS_QUARTER) {
    items.push({ priority: 'P2', label, sortOrder: order++ });
  }
  return items;
}

/**
 * Known roles for the exit-viability task tracking system.
 * Derived from PERSONS — the shared source of truth for operational identities.
 * `code` matches the "Name:" prefix used in PRIORITY_ACTIONS labels (with
 * secondary lowercase match in parseTaskLabel for case-insensitive lookup).
 * Preserves the original capitalized codes so existing task labels continue to work.
 */
const KNOWN_ROLES: { code: string; name: string; isPlatformAdmin?: boolean; email?: string }[] =
  PERSONS.filter((p) => p.sub !== 'admin' || true).map((p) => {
    // Use the original capitalized code for task-label backward compat.
    // Map the new persons schema to the legacy KNOWN_ROLES shape.
    const legacyCode =
      p.sub === 'admin' ? 'Admin' :
      p.sub === 'ama' ? 'Ama' :
      p.sub === 'graham' ? 'Graham' :
      p.sub === 'james' ? 'James' :
      p.sub === 'lucas' ? 'Lukas' :    // task labels use "Lukas:"
      p.sub === 'made' ? 'Made' : p.sub;
    return {
      code: legacyCode,
      name: p.isPlatformAdmin ? p.name : `${p.name} (${p.roleName})`,
      isPlatformAdmin: p.isPlatformAdmin,
      email: p.email,
    };
  });

/** Resolve a known role by email (case-insensitive). Used by Google sign-in. */
export function resolveRoleForEmail(email: string | undefined): {
  code: string;
  name: string;
  isPlatformAdmin: boolean;
} | null {
  if (!email) return null;
  const match = PERSONS.find((p) => p.email && p.email.toLowerCase() === email.toLowerCase());
  if (!match) return null;
  return { code: match.roleCode, name: match.name, isPlatformAdmin: match.isPlatformAdmin ?? false };
}

/**
 * Operational identities the system knows about (PIN roles + platform admins).
 * Used to backfill user_account rows so the User Accounts list shows prior users
 * even before they re-sign-in. Platform admin uses sub 'admin'; PIN roles use
 * their lowercased code as sub (matching verify-pin).
 */
export function listKnownAccounts(): { sub: string; name: string; tier: string; roleCode?: string | null }[] {
  return PERSONS.map((p) => ({
    sub: p.sub,
    name: p.name,
    tier: 'pin',
    roleCode: p.roleCode,
  }));
}

/** Parse "Ama: do the thing" → { ownerCodes: ['Ama'], title: 'do the thing' }. */
function parseTaskLabel(label: string): { ownerCodes: string[]; title: string } {
  const match = label.match(/^([A-Za-z][A-Za-z+& ]*?):\s*(.+)$/);
  if (!match) {
    return { ownerCodes: [], title: label.trim() };
  }
  const ownerPart = match[1].trim();
  const title = match[2].trim();
  // Split on + & , / to support "Lukas + Made", "Ama & Graham", etc.
  const ownerCodes = ownerPart
    .split(/[+&,/]/)
    .map((s) => s.trim())
    .filter((s) => KNOWN_ROLES.some((r) => r.code.toLowerCase() === s.toLowerCase()));
  return { ownerCodes, title };
}

interface BuiltTask {
  title: string;
  priority: ActionPriority;
  ownerCodes: string[];
  dueOffsetDays: number;
  description: string | null;
}

/** Normalize a task title to match a TASK_PLAYBOOK key. */
function playbookKey(title: string): string {
  return title.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Build the tracked-task list from PRIORITY_ACTIONS.
 * P0 → due in 7 days, P1 → 14 days, P2 → 42 days (relative to seed run).
 */
/** Individual (non-admin) role codes that tasks can be assigned to. */
const INDIVIDUAL_ROLE_CODES = KNOWN_ROLES.filter((r) => !r.isPlatformAdmin).map((r) => r.code);

/**
 * Resolve effective owner codes for a task. A task owned by "All" (or with no
 * recognized owner) is assigned to every individual role so it appears in the
 * per-role dashboard and for each role's users.
 */
function resolveOwnerCodes(ownerCodes: string[]): string[] {
  if (ownerCodes.length === 0) return [...INDIVIDUAL_ROLE_CODES];
  return ownerCodes;
}

function buildTasks(): BuiltTask[] {
  const tasks: BuiltTask[] = [];
  const push = (labels: string[], priority: ActionPriority, dueOffsetDays: number) => {
    for (const label of labels) {
      const { ownerCodes, title } = parseTaskLabel(label);
      const play = TASK_PLAYBOOK[playbookKey(title)];
      const description = play
        ? `${play.description}\n\nSteps:\n${play.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}`
        : null;
      tasks.push({
        title,
        priority,
        ownerCodes: resolveOwnerCodes(ownerCodes),
        dueOffsetDays,
        description,
      });
    }
  };
  push(PRIORITY_ACTIONS.P0_THIS_WEEK, 'P0', 7);
  push(PRIORITY_ACTIONS.P1_THIS_MONTH, 'P1', 14);
  push(PRIORITY_ACTIONS.P2_THIS_QUARTER, 'P2', 42);
  return tasks;
}

export async function ensureLegacyTables(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(DAILY_METRICS_DDL);
  await prisma.$executeRawUnsafe(MONTHLY_TARGETS_DDL);
}

export async function ensureContentTables(prisma: PrismaClient): Promise<void> {
  for (const sql of CONTENT_ENUM_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  for (const sql of BLOCK_TYPE_ALTER_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  for (const sql of CONTENT_TABLE_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
}

/**
 * Idempotent creation of the task-tracking tables (roles, tasks, task_assignments).
 * Safe to call on every request — all statements use CREATE TABLE IF NOT EXISTS.
 * Ensures the Tasks feature works even before a full reseed has run.
 * Accepts either a plain or ZenStack-enhanced Prisma client.
 */
export async function ensureTaskTables(prisma: {
  $executeRawUnsafe: (sql: string) => Promise<unknown>;
}): Promise<void> {
  for (const sql of CONTENT_ENUM_STATEMENTS) {
    await prisma.$executeRawUnsafe(sql);
  }
  for (const sql of CONTENT_TABLE_STATEMENTS.slice(-4)) {
    await prisma.$executeRawUnsafe(sql);
  }
}

/**
 * Bootstrap the task-tracking data (roles + tasks + assignments) if empty.
 * Uses the ZenStack-enhanced client so policy checks apply. Idempotent.
 */
export async function seedTaskTracking(prisma: DbClient): Promise<void> {
  // Always sync known roles (idempotent upsert) so emails/platform-admin flags stay current.
  const roleIdByCode = new Map<string, string>();
  for (const role of KNOWN_ROLES) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      create: {
        code: role.code,
        name: role.name,
        isPlatformAdmin: role.isPlatformAdmin ?? false,
        email: role.email ?? null,
      },
      update: {
        name: role.name,
        isPlatformAdmin: role.isPlatformAdmin ?? false,
        email: role.email ?? null,
      },
    });
    roleIdByCode.set(created.code, created.id);
  }

  const existingTasks = await prisma.task.findMany({ take: 1 });
  if (existingTasks.length > 0) {
    // Tasks already exist — backfill any missing descriptions from the playbook
    // without disturbing status/progress. Then ensure assignments are intact.
    const builtAll = buildTasks();
    for (const built of builtAll) {
      const existing = await prisma.task.findFirst({ where: { title: built.title } });
      if (existing && !existing.description?.trim() && built.description) {
        await prisma.task.update({
          where: { id: existing.id },
          data: { description: built.description },
        });
      }
    }
    return;
  }

  await prisma.taskAssignment.deleteMany();
  await prisma.task.deleteMany();

  let taskOrder = 0;
  const now = Date.now();
  for (const built of buildTasks()) {
    const dueDate = new Date(now + built.dueOffsetDays * 24 * 60 * 60 * 1000);
    const task = await prisma.task.create({
      data: {
        title: built.title,
        description: built.description,
        priority: built.priority,
        status: 'pending',
        dueDate,
        sortOrder: taskOrder++,
      },
    });
    const ownerCodes = built.ownerCodes.length > 0 ? built.ownerCodes : [];
    for (const code of ownerCodes) {
      const roleId = roleIdByCode.get(code);
      if (!roleId) continue;
      await prisma.taskAssignment.create({ data: { taskId: task.id, roleId, assigned: true } });
    }
  }
}

async function upsertFinancialProjectionRaw(
  prisma: PrismaClient,
  row: FinancialProjectionRow,
): Promise<void> {
  const pnlJson = JSON.stringify(row.pnlLines);
  await prisma.$executeRaw`
    INSERT INTO financial_projections (period, year, month, data_type, scenario, revenue, ebitda, net_income, guests, staff_cost, pnl_lines)
    VALUES (${row.period}, ${row.year}, ${row.month}, ${row.dataType}, ${row.scenario}, ${row.revenue}, ${row.ebitda}, ${row.netIncome}, ${row.guests}, ${row.staffCost}, ${pnlJson}::jsonb)
    ON CONFLICT (period, data_type, scenario)
    DO UPDATE SET
      year = EXCLUDED.year,
      month = EXCLUDED.month,
      revenue = EXCLUDED.revenue,
      ebitda = EXCLUDED.ebitda,
      net_income = EXCLUDED.net_income,
      guests = EXCLUDED.guests,
      staff_cost = EXCLUDED.staff_cost,
      pnl_lines = EXCLUDED.pnl_lines
  `;
}

interface ResolvedSources {
  excel?: Buffer | Buffer[];
  businessReview?: string;
  executiveSummary?: string;
  filesUsed: Record<SourceFileKey, 'upload' | 'disk'>;
}

function resolveSources(options: SeedOptions): ResolvedSources {
  const sourceDir = options.sourceDir ?? getSourceDir({ excel: !!options.overrides?.excel });
  const overrides = options.overrides ?? {};
  const filesUsed: Record<SourceFileKey, 'upload' | 'disk'> = {
    excel: 'disk',
    businessReview: 'disk',
    executiveSummary: 'disk',
  };

  // Handle each override independently — never throw if only one source is being updated.
  if (overrides.excel) {
    filesUsed.excel = 'upload';
    if (options.persistOverrides) {
      try {
        // If multiple buffers, concatenate for file storage
        const buf = Array.isArray(overrides.excel)
          ? Buffer.concat(overrides.excel)
          : overrides.excel;
        writeSourceFile('excel', buf, sourceDir);
      } catch (err) {
        console.warn('[seed] Could not persist excel to disk (read-only filesystem?):', err instanceof Error ? err.message : err);
      }
    }
  }
  if (overrides.businessReview) {
    filesUsed.businessReview = 'upload';
    if (options.persistOverrides) {
      try {
        writeSourceFile('businessReview', overrides.businessReview, sourceDir);
      } catch (err) {
        console.warn('[seed] Could not persist businessReview to disk (read-only filesystem?):', err instanceof Error ? err.message : err);
      }
    }
  }
  if (overrides.executiveSummary) {
    filesUsed.executiveSummary = 'upload';
    if (options.persistOverrides) {
      try {
        writeSourceFile('executiveSummary', overrides.executiveSummary, sourceDir);
      } catch (err) {
        console.warn('[seed] Could not persist executiveSummary to disk (read-only filesystem?):', err instanceof Error ? err.message : err);
      }
    }
  }

  // Resolve each source independently — return undefined if not provided and not on disk.
  const excel =
    overrides.excel ??
    (sourceFileExists('excel', sourceDir)
      ? readSourceFile('excel', sourceDir)
      : undefined);

  const businessReview =
    overrides.businessReview ??
    (sourceFileExists('businessReview', sourceDir)
      ? readSourceText('businessReview', sourceDir)
      : undefined);

  const executiveSummary =
    overrides.executiveSummary ??
    (sourceFileExists('executiveSummary', sourceDir)
      ? readSourceText('executiveSummary', sourceDir)
      : undefined);

  // Validate: at least one source must be provided/available.
  if (excel === undefined && businessReview === undefined && executiveSummary === undefined) {
    throw new Error(
      'No sources found — upload at least the Business Review (.md) or Executive Summary (.md). ' +
        ('To update both without changing the workbook, use just the two markdown uploads.')
    );
  }

  return { excel, businessReview, executiveSummary, filesUsed };
}

export async function seedFromSources(options: SeedOptions = {}): Promise<SeedResult> {
  const dryRun = options.dryRun ?? false;
  loadEnvLocal();

  const { excel, businessReview, executiveSummary, filesUsed } = resolveSources(options);

  // Normalize excel: if multiple buffers, use first for legacy operations
  const excelBuffer: Buffer | undefined = Array.isArray(excel) ? excel[0] : excel;
  const excelBuffers: Buffer[] = Array.isArray(excel) ? excel : (excel ? [excel] : []);

  // Parse projections from Excel if it's available — otherwise skip.
  // Gracefully handles workbooks that don't match the expected RedRuby/2027/2029/2030 sheet layout.
  let projections: FinancialProjectionRow[] | null = null;
  if (excelBuffer) {
    try {
      projections = parseFinancialProjectionsFromBuffer(excelBuffer);
    } catch (err) {
      console.warn('[seed] Could not parse financial projections from workbook (wrong format?):', err instanceof Error ? err.message : err);
      projections = null;
    }
  }

  // ── Workbook analysis (derive sheet metadata, dynamic pages, use cases) ──
  let workbookAnalysisMd = '';
  const sheetSnippets: { key: string; category: string; content: string }[] = [];
  const allAnalyses: import('@/domain/excel/workbook-analyzer').WorkbookAnalysis[] = [];

  // Analyze each uploaded workbook and combine results
  for (let wi = 0; wi < excelBuffers.length; wi++) {
    const buf = excelBuffers[wi];
    const label = excelBuffers.length > 1 ? `workbook ${wi + 1}` : 'uploaded workbook';
    try {
      const analysis = analyzeWorkbook(buf, filesUsed.excel === 'upload' ? label : undefined);
      allAnalyses.push(analysis);

      // Register dynamic pages for each sheet (only from the primary workbook)
      if (wi === 0) {
        const dynamicPages = generatePagesFromAnalysis(analysis);
        setDynamicPages(dynamicPages);
        console.log(`[seed] Generated ${dynamicPages.length} dynamic page(s) from workbook analysis`);
      }

      // Create per-sheet knowledge snippets
      for (const sheet of analysis.sheets) {
        if (sheet.columns.length < 2) continue;
        const snippetKey = `sheet_${sheet.slug.replace(/-/g, '_')}${wi > 0 ? `_${wi}` : ''}`;
        sheetSnippets.push({
          key: snippetKey,
          category: 'sheet',
          content: generateSheetMarkdown(sheet),
        });
      }
    } catch (err) {
      console.warn(`[seed] Workbook ${wi + 1} analysis failed (non-critical):`, err instanceof Error ? err.message : err);
    }
  }

  // Build combined workbook overview from all analyses
  if (allAnalyses.length === 1) {
    workbookAnalysisMd = generateAnalysisMarkdown(allAnalyses[0]);
  } else if (allAnalyses.length > 1) {
    // Merge analyses into a single combined overview
    const combined = {
      fileName: `${allAnalyses.length} workbooks merged`,
      company: allAnalyses[0].company,
      period: allAnalyses[0].period,
      sheetCount: allAnalyses.reduce((n, a) => n + a.sheetCount, 0),
      sheets: allAnalyses.flatMap((a) => a.sheets),
      categoriesFound: Array.from(new Set(allAnalyses.flatMap((a) => a.categoriesFound))),
      summary: allAnalyses.map((a) => a.summary).join('\n'),
    };
    workbookAnalysisMd = generateAnalysisMarkdown(combined as import('@/domain/excel/workbook-analyzer').WorkbookAnalysis);
  }

  // Create the workbook overview snippet
  if (workbookAnalysisMd) {
    sheetSnippets.push({
      key: 'workbook_summary',
      category: 'document',
      content: workbookAnalysisMd,
    });
  }

  const reviewParts = businessReview !== undefined ? parseBusinessReviewParts(businessReview) : [];

  // Register parsed parts in the catalog so listReviewParts() includes H–O
  if (reviewParts.length > 0) {
    setDynamicReviewParts(
      reviewParts.map(
        (p): ReviewPartDefinition => ({
          partSlug: p.slug,
          partKey: p.partKey,
          title: p.title,
          authTier: 'google',
        }),
      ),
    );
  }

  let termsMd = '';
  let privacyMd = '';
  try {
    termsMd = htmlToMarkdownish(readUtf8(TERMS_HTML_PATH));
    privacyMd = htmlToMarkdownish(readUtf8(PRIVACY_HTML_PATH));
  } catch (err) {
    console.warn('[seed] Could not read legal HTML files (serverless deployment?):', err instanceof Error ? err.message : err);
  }
  const knowledgeSnippets = buildKnowledgeSnippets(executiveSummary ?? '', termsMd, privacyMd);

  // Append workbook analysis as a knowledge snippet
  if (workbookAnalysisMd) {
    knowledgeSnippets.push({
      key: 'workbook_analysis',
      category: 'document',
      content: workbookAnalysisMd,
    });
  }

  // Append per-sheet description snippets so the content API can
  // serve doc_markdown blocks for dynamically generated sheet pages.
  for (const s of sheetSnippets) {
    knowledgeSnippets.push(s);
  }

  // Cache each workbook as a base64 knowledge snippet so the AI Content
  // Generation endpoint and reprocess can read them on serverless runtimes
  // where the filesystem is read-only.
  const allExcelBuffers: Buffer[] = Array.isArray(excel) ? excel : (excel ? [excel] : []);
  if (allExcelBuffers.length > 0) {
    knowledgeSnippets.push({
      key: 'workbook_data',
      category: 'cache',
      content: allExcelBuffers[0]!.toString('base64'),
    });
    // Additional workbooks stored as workbook_data_1, workbook_data_2, etc.
    for (let i = 1; i < allExcelBuffers.length; i++) {
      knowledgeSnippets.push({
        key: `workbook_data_${i}`,
        category: 'cache',
        content: allExcelBuffers[i]!.toString('base64'),
      });
    }
  }
  const actionItems = buildActionItems();
  const builtTasks = buildTasks();
  const pageEntries = Object.values(getFullCatalog());

  const counts: SeedCounts = {
    financialProjections: projections ? projections.length : 0,
    businessReviewParts: reviewParts.length,
    levers: FIVE_LEVERS.length,
    actionItems: actionItems.length,
    monthlyTargets: MONTHLY_TARGETS.length,
    knowledgeSnippets: knowledgeSnippets.length,
    appPages: pageEntries.length,
    pageSections: pageEntries.reduce((n, p) => n + p.sections.length, 0),
    roles: KNOWN_ROLES.length,
    tasks: builtTasks.length,
    taskAssignments: builtTasks.reduce((n, t) => n + Math.max(t.ownerCodes.length, 1), 0),
  };

  if (reviewParts.length === 0) {
    console.warn('[seed] No review parts parsed — the Business Review MD may not contain "## Part <label>: <title>" sections');
  } else {
    console.log(`[seed] Parsed ${reviewParts.length} review part(s): ${reviewParts.map((p) => p.title).join(', ')}`);
  }

  const connStr = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connStr) {
    console.log('[seed] POSTGRES_URL not set — dry-run only (parsers validated, no DB writes).');
    return { counts, filesUsed };
  }

  if (dryRun) {
    console.log('[seed] --dry-run: skipping DB writes.');
    return { counts, filesUsed };
  }

  const prisma = new PrismaClient({ datasources: { db: { url: connStr } } });

  try {
    await ensureLegacyTables(prisma);
    await ensureContentTables(prisma);

    if (projections) {
      for (const row of projections) {
        await upsertFinancialProjectionRaw(prisma, row);
      }
    }

    for (const part of reviewParts) {
      const catalog = REVIEW_PART_CATALOG[part.slug];
      const authTier = (catalog?.authTier ?? 'google') as AuthTier;
      await prisma.businessReviewPart.upsert({
        where: { slug: part.slug },
        create: {
          partKey: part.partKey,
          slug: part.slug,
          title: catalog?.title ?? part.title,
          sortOrder: part.sortOrder,
          authTier,
          markdown: part.markdown,
        },
        update: {
          partKey: part.partKey,
          title: catalog?.title ?? part.title,
          sortOrder: part.sortOrder,
          authTier,
          markdown: part.markdown,
        },
      });
    }

    for (const lever of FIVE_LEVERS) {
      const description = [
        `Target: ${lever.target}`,
        '',
        'Actions:',
        ...lever.actions.map((a) => `- ${a}`),
      ].join('\n');
      await prisma.lever.upsert({
        where: { num: lever.num },
        create: {
          num: lever.num,
          name: lever.name,
          impact: lever.impact,
          description,
        },
        update: {
          name: lever.name,
          impact: lever.impact,
          description,
        },
      });
    }

    await prisma.actionItem.deleteMany();
    await prisma.actionItem.createMany({
      data: actionItems.map((item) => ({
        priority: item.priority,
        label: item.label,
        sortOrder: item.sortOrder,
        completed: false,
      })),
    });

    // ── Task tracking: roles, tasks, assignments ──
    const roleIdByCode = new Map<string, string>();
    for (const role of KNOWN_ROLES) {
      const created = await prisma.role.upsert({
        where: { code: role.code },
        create: {
          code: role.code,
          name: role.name,
          isPlatformAdmin: role.isPlatformAdmin ?? false,
          email: role.email ?? null,
        },
        update: {
          name: role.name,
          isPlatformAdmin: role.isPlatformAdmin ?? false,
          email: role.email ?? null,
        },
      });
      roleIdByCode.set(role.code, created.id);
    }

    // Recreate tasks from the current priority actions (idempotent by title+sortOrder).
    await prisma.taskAssignment.deleteMany();
    await prisma.task.deleteMany();

    let taskOrder = 0;
    const now = Date.now();
    for (const built of builtTasks) {
      const dueDate = new Date(now + built.dueOffsetDays * 24 * 60 * 60 * 1000);
      const task = await prisma.task.create({
        data: {
          title: built.title,
          description: built.description,
          priority: built.priority,
          status: 'pending' as TaskStatus,
          dueDate,
          sortOrder: taskOrder++,
        },
      });
      const ownerCodes = built.ownerCodes.length > 0 ? built.ownerCodes : [];
      for (const code of ownerCodes) {
        const roleId = roleIdByCode.get(code);
        if (!roleId) continue;
        await prisma.taskAssignment.create({
          data: { taskId: task.id, roleId, assigned: true },
        });
      }
    }

    for (const target of MONTHLY_TARGETS) {
      await prisma.monthlyTarget.upsert({
        where: { month: target.month },
        create: {
          month: target.month,
          targetRevenue: target.revenue,
          targetEbitda: target.ebitda,
          targetGuests: target.guests,
          targetAvgSpend: target.spend,
          targetStaffCostPct: target.staffPct,
        },
        update: {
          targetRevenue: target.revenue,
          targetEbitda: target.ebitda,
          targetGuests: target.guests,
          targetAvgSpend: target.spend,
          targetStaffCostPct: target.staffPct,
        },
      });
    }

    for (const snippet of knowledgeSnippets) {
      await prisma.knowledgeSnippet.upsert({
        where: { key: snippet.key },
        create: snippet,
        update: { category: snippet.category, content: snippet.content },
      });
    }

    let pageSort = 0;
    for (const page of pageEntries) {
      const appPage = await prisma.appPage.upsert({
        where: { slug: page.slug },
        create: {
          slug: page.slug,
          title: page.title,
          authTier: page.authTier as AuthTier,
          sortOrder: pageSort++,
        },
        update: {
          title: page.title,
          authTier: page.authTier as AuthTier,
          sortOrder: pageSort - 1,
        },
      });

      await prisma.pageSection.deleteMany({ where: { pageId: appPage.id } });
      await prisma.pageSection.createMany({
        data: page.sections.map((section, index) => ({
          pageId: appPage.id,
          sortOrder: index,
          blockType: section.blockType as BlockType,
          config: section.config as Prisma.InputJsonValue,
        })),
      });
    }

    return { counts, filesUsed };
  } finally {
    await prisma.$disconnect();
  }
}
