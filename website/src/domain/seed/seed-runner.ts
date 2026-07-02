import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  PrismaClient,
  type ActionPriority,
  type AuthTier,
  type BlockType,
  type Prisma,
} from '@/generated/prisma';
import { PAGE_CATALOG, REVIEW_PART_CATALOG } from '@/lib/page-catalog';
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
} from '../../../lib/knowledge-base.js';

export interface SeedCounts {
  financialProjections: number;
  businessReviewParts: number;
  levers: number;
  actionItems: number;
  monthlyTargets: number;
  knowledgeSnippets: number;
  appPages: number;
  pageSections: number;
}

export interface SeedSourceOverrides {
  excel?: Buffer;
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
  `DO $$ BEGIN CREATE TYPE "BlockType" AS ENUM ('hero', 'metric_grid', 'chart_financial', 'lever_accordion', 'action_checklist', 'doc_markdown', 'pnl_table', 'z_report_form', 'costs_form', 'calendar_import', 'chat_panel', 'kpi_cards', 'ops_admin_tabs', 'review_blocks', 'reports_rollup'); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
];

const BLOCK_TYPE_ALTER_STATEMENTS = [
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'ops_admin_tabs'`,
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'review_blocks'`,
  `ALTER TYPE "BlockType" ADD VALUE IF NOT EXISTS 'reports_rollup'`,
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
  excel: Buffer;
  businessReview: string;
  executiveSummary: string;
  filesUsed: Record<SourceFileKey, 'upload' | 'disk'>;
}

function resolveSources(options: SeedOptions): ResolvedSources {
  const sourceDir = options.sourceDir ?? getSourceDir();
  const overrides = options.overrides ?? {};
  const filesUsed: Record<SourceFileKey, 'upload' | 'disk'> = {
    excel: 'disk',
    businessReview: 'disk',
    executiveSummary: 'disk',
  };

  if (overrides.excel) {
    filesUsed.excel = 'upload';
    if (options.persistOverrides) {
      writeSourceFile('excel', overrides.excel, sourceDir);
    }
  }
  if (overrides.businessReview) {
    filesUsed.businessReview = 'upload';
    if (options.persistOverrides) {
      writeSourceFile('businessReview', overrides.businessReview, sourceDir);
    }
  }
  if (overrides.executiveSummary) {
    filesUsed.executiveSummary = 'upload';
    if (options.persistOverrides) {
      writeSourceFile('executiveSummary', overrides.executiveSummary, sourceDir);
    }
  }

  const excel =
    overrides.excel ??
    (sourceFileExists('excel', sourceDir)
      ? readSourceFile('excel', sourceDir)
      : (() => {
          throw new Error('Cashflow workbook not found — upload the XLSX or place it in the source directory.');
        })());

  const businessReview =
    overrides.businessReview ??
    (sourceFileExists('businessReview', sourceDir)
      ? readSourceText('businessReview', sourceDir)
      : (() => {
          throw new Error(
            'Business Review markdown not found — upload the MD file or place it in the source directory.',
          );
        })());

  const executiveSummary =
    overrides.executiveSummary ??
    (sourceFileExists('executiveSummary', sourceDir)
      ? readSourceText('executiveSummary', sourceDir)
      : (() => {
          throw new Error(
            'Executive Summary markdown not found — upload the MD file or place it in the source directory.',
          );
        })());

  return { excel, businessReview, executiveSummary, filesUsed };
}

export async function seedFromSources(options: SeedOptions = {}): Promise<SeedResult> {
  const dryRun = options.dryRun ?? false;
  loadEnvLocal();

  const { excel, businessReview, executiveSummary, filesUsed } = resolveSources(options);

  const projections = parseFinancialProjectionsFromBuffer(excel);

  const reviewParts = parseBusinessReviewParts(businessReview);
  const termsMd = htmlToMarkdownish(readUtf8(TERMS_HTML_PATH));
  const privacyMd = htmlToMarkdownish(readUtf8(PRIVACY_HTML_PATH));
  const knowledgeSnippets = buildKnowledgeSnippets(executiveSummary, termsMd, privacyMd);
  const actionItems = buildActionItems();
  const pageEntries = Object.values(PAGE_CATALOG);

  const counts: SeedCounts = {
    financialProjections: projections.length,
    businessReviewParts: reviewParts.length,
    levers: FIVE_LEVERS.length,
    actionItems: actionItems.length,
    monthlyTargets: MONTHLY_TARGETS.length,
    knowledgeSnippets: knowledgeSnippets.length,
    appPages: pageEntries.length,
    pageSections: pageEntries.reduce((n, p) => n + p.sections.length, 0),
  };

  if (reviewParts.length !== 15) {
    console.warn(`[seed] Expected 15 review parts, got ${reviewParts.length}`);
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

    for (const row of projections) {
      await upsertFinancialProjectionRaw(prisma, row);
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
