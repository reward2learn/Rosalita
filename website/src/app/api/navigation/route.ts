/**
 * Public Navigation API
 *
 * GET /api/navigation
 *   Returns the navigation tree (visible items only, filtered by auth tier + groups).
 *   No auth required — used by the app shell drawer.
 *
 * Query params:
 *   tier — current user's auth tier (public|pin|google) — defaults to public
 *   groups — comma-separated group codes the user belongs to
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

function getClient() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');
  return new PrismaClient({ datasources: { db: { url } } });
}

const TIER_RANK: Record<string, number> = { public: 0, pin: 1, google: 2 };

interface NavItem {
  id: string;
  parentId: string | null;
  sortOrder: number;
  title: string;
  path: string;
  icon: string;
  authTier: string;
  requiredGroups: string;
  isVisible: boolean;
  isDynamic: boolean;
  isDefault: boolean;
  children: NavItem[];
}

export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const tier = searchParams.get('tier') || 'public';
  const groupsParam = searchParams.get('groups') || '';
  const userGroups = groupsParam.split(',').map((g) => g.trim()).filter(Boolean);
  const userTierRank = TIER_RANK[tier] ?? 0;

  // If no DB is configured, return empty nav (graceful fallback for dev/demo)
  const dbUrl = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    return NextResponse.json({ items: [] });
  }

  const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });
  try {
    const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, parent_id AS "parentId", sort_order AS "sortOrder", title, path, icon,
              auth_tier AS "authTier", required_groups AS "requiredGroups",
              is_visible AS "isVisible", is_dynamic AS "isDynamic", is_default AS "isDefault"
       FROM navigation_items
       WHERE is_visible = TRUE
       ORDER BY sort_order ASC`,
    );

    // Filter by tier + group access
    const filtered: NavItem[] = [];
    for (const r of rows) {
      const itemTierRank = TIER_RANK[String(r.authTier ?? 'public')] ?? 0;
      if (itemTierRank > userTierRank) continue;

      const reqGroups = String(r.requiredGroups ?? '');
      if (reqGroups) {
        const groups = reqGroups.split(',').map((g: string) => g.trim()).filter(Boolean);
        if (groups.length > 0 && !groups.some((g: string) => userGroups.includes(g)) && !userGroups.includes('platform-admin')) {
          continue;
        }
      }

      filtered.push({
        id: r.id as string,
        parentId: r.parentId as string | null,
        sortOrder: Number(r.sortOrder ?? 0),
        title: r.title as string,
        path: r.path as string,
        icon: r.icon as string,
        authTier: r.authTier as string,
        requiredGroups: r.requiredGroups as string,
        isVisible: Boolean(r.isVisible),
        isDynamic: Boolean(r.isDynamic),
        isDefault: Boolean(r.isDefault),
        children: [],
      });
    }

    // Build tree
    const itemMap = new Map<string, NavItem>();
    const roots: NavItem[] = [];
    for (const item of filtered) itemMap.set(item.id, item);
    for (const item of filtered) {
      if (item.parentId && itemMap.has(item.parentId)) {
        itemMap.get(item.parentId)!.children.push(item);
      } else {
        roots.push(item);
      }
    }

    return NextResponse.json({ items: roots });
  } catch (err) {
    console.error('[navigation] Failed to read:', err);
    return NextResponse.json({ items: [] });
  } finally {
    await prisma.$disconnect();
  }
}
