/**
 * Shared navigation_items table helpers — used by
 * GET /api/navigation and /api/admin/navigation.
 */

import type { PrismaClient } from '@/generated/prisma';
import { getTemplate } from '@/domain/tenant/template-catalog';

const NAV_DDL = `
CREATE TABLE IF NOT EXISTS navigation_items (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES navigation_items(id) ON DELETE SET NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  path TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT '',
  auth_tier TEXT NOT NULL DEFAULT 'public',
  required_groups TEXT NOT NULL DEFAULT '',
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  is_dynamic BOOLEAN NOT NULL DEFAULT FALSE,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export async function ensureNavigationTable(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(NAV_DDL);
  // Ensure updated_at has a default so raw inserts don't fail on NOT NULL
  try {
    await prisma.$executeRawUnsafe(
      "ALTER TABLE navigation_items ALTER COLUMN updated_at SET DEFAULT CURRENT_TIMESTAMP"
    );
  } catch {
    /* column may not exist yet if table was just created */
  }

  for (const col of [
    'ADD COLUMN IF NOT EXISTS is_dynamic BOOLEAN NOT NULL DEFAULT FALSE',
    'ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE',
  ]) {
    try {
      await prisma.$executeRawUnsafe(`ALTER TABLE navigation_items ${col}`);
    } catch {
      /* column exists or older PG without IF NOT EXISTS */
    }
  }
}

interface CatalogPage {
  slug: string;
  title: string;
  authTier: string;
  navLabel?: string;
  showInNav?: boolean;
  requiredGroups?: string[];
}

/**
 * Slugs that are always-present infrastructure pages.
 * These are seeded from the page catalog regardless of tenant template.
 * All other nav items come from the tenant template (app_pages).
 */
const STATIC_NAV_SLUGS = new Set(['admin', 'config', 'ops-chat']);

async function deriveNavItemsFromCatalog(): Promise<
  { id: string; title: string; path: string; authTier: string }[]
> {
  const { getFullCatalog } = await import('@/lib/page-catalog');
  const catalog = getFullCatalog();
  return Object.entries(catalog)
    .filter(([slug, p]) => STATIC_NAV_SLUGS.has(slug) && (p as CatalogPage).showInNav !== false)
    .map(([slug, page]) => {
      const p = page as CatalogPage;
      return {
        id: `static-${slug}`,
        title: p.navLabel ?? p.title,
        path: `/${slug}`,
        authTier: p.authTier,
      };
    });
}

/**
 * Idempotently insert static infrastructure nav items from the page catalog.
 * Template-driven pages are NOT seeded here — they come from the tenant template
 * via app_pages. Returns the number of rows inserted.
 */
export async function seedMissingNavigationFromCatalog(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.$queryRawUnsafe<{ id: string; path: string }[]>(
    `SELECT id, path FROM navigation_items`,
  );
  const existingIds = new Set(existing.map((r) => r.id));
  const existingPaths = new Set(existing.map((r) => r.path));

  const catalogItems = await deriveNavItemsFromCatalog();
  let inserted = 0;

  const insertIfMissing = async (id: string, title: string, path: string, authTier: string) => {
    if (existingIds.has(id) || existingPaths.has(path)) return;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO navigation_items (id, parent_id, sort_order, title, path, icon, auth_tier, required_groups, is_visible, is_dynamic, updated_at)
         VALUES ($1, NULL, $2, $3, $4, '', CAST($5 AS "AuthTier"), '', TRUE, FALSE, NOW())`,
        id,
        inserted,
        title,
        path,
        authTier,
      );
      existingIds.add(id);
      inserted++;
    } catch (err) {
      console.error(`[navigation] Failed to seed item ${id}:`, err);
    }
  };

  for (const item of catalogItems) {
    await insertIfMissing(item.id, item.title, item.path, item.authTier);
  }

  return inserted;
}


/**
 * Seed navigation items from the active template in app_settings.
 * Called on every GET /api/navigation to ensure template-driven pages appear.
 * Idempotent: skips items that already exist (by path).
 */
export async function seedTemplateNavItems(prisma: PrismaClient): Promise<number> {
  // Read the active template from app_settings
  let templateId = 'default';
  try {
    const rows = await prisma.$queryRawUnsafe<{ tenant_template: string }[]>(
      `SELECT tenant_template FROM app_settings LIMIT 1`
    );
    if (rows.length > 0 && rows[0].tenant_template) {
      templateId = rows[0].tenant_template;
    }
  } catch {
    // app_settings table may not exist yet
    return 0;
  }

  const template = getTemplate(templateId);
  if (!template || template.id === 'default') return 0; // no template nav to seed for generic

  const existing = await prisma.$queryRawUnsafe<{ id: string; path: string }[]>(
    `SELECT id, path FROM navigation_items`
  );
  const existingPaths = new Set(existing.map((r) => r.path));

  let inserted = 0;
  for (const nav of template.defaultNavItems) {
    if (existingPaths.has(nav.path)) continue;
    const id = `template-${templateId}-${nav.path.replace(/^\//, '').replace(/\//g, '-')}`;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO navigation_items (id, parent_id, sort_order, title, path, icon, auth_tier, required_groups, is_visible, is_dynamic, updated_at)
         VALUES ($1, NULL, $2, $3, $4, $5, CAST($6 AS "AuthTier"), '', TRUE, TRUE, NOW())
         ON CONFLICT (id) DO NOTHING`,
        id,
        100 + inserted, // template items after static infra
        nav.title,
        nav.path,
        nav.icon,
        nav.authTier,
      );
      inserted++;
    } catch (err) {
      console.error(`[navigation] Failed to seed template item ${id}:`, err);
    }
  }

  if (inserted > 0) console.log(`[navigation] Seeded ${inserted} template nav items for ${templateId}`);
  return inserted;
}
