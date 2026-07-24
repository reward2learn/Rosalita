/**
 * Shared navigation_items table helpers — used by
 * GET /api/navigation and /api/admin/navigation.
 */

import type { PrismaClient } from '@/generated/prisma';

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

async function deriveNavItemsFromCatalog(): Promise<
  { id: string; title: string; path: string; authTier: string }[]
> {
  const { getFullCatalog } = await import('@/lib/page-catalog');
  const catalog = getFullCatalog();
  return Object.entries(catalog)
    .filter(([, p]) => (p as CatalogPage).showInNav !== false)
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
 * Idempotently insert any page-catalog / app_pages rows missing from navigation_items.
 * Returns the number of rows inserted.
 */
export async function seedMissingNavigationFromCatalog(prisma: PrismaClient): Promise<number> {
  const existing = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM navigation_items`,
  );
  const existingIds = new Set(existing.map((r) => r.id));

  const catalogItems = await deriveNavItemsFromCatalog();
  let inserted = 0;

  const insertIfMissing = async (id: string, title: string, path: string, authTier: string) => {
    if (existingIds.has(id)) return;
    try {
      await prisma.$executeRawUnsafe(
        `INSERT INTO navigation_items (id, parent_id, sort_order, title, path, icon, auth_tier, required_groups, is_visible, is_dynamic)
         VALUES ($1, NULL, $2, $3, $4, '', $5, '', TRUE, FALSE)`,
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

  try {
    const dbPages = await prisma.$queryRawUnsafe<
      { slug: string; title: string; auth_tier: string }[]
    >(`SELECT slug, title, auth_tier FROM app_pages ORDER BY sort_order ASC`);
    for (const dbp of dbPages) {
      const navId = `static-${dbp.slug}`;
      if (!existingIds.has(navId)) {
        await insertIfMissing(navId, dbp.title, `/${dbp.slug}`, dbp.auth_tier);
      }
    }
  } catch {
    /* app_pages may not exist yet */
  }

  return inserted;
}
