/**
 * Default Route API
 *
 * GET /api/default-route
 *   Returns: { path: string } — the default nav item's path, or "/dashboard"
 *   No auth required — called by the root page redirect on every visit.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!url) return NextResponse.json({ path: '/dashboard' });

    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const rows = await prisma.$queryRawUnsafe<{ path: string }[]>(
        `SELECT path FROM navigation_items WHERE is_default = TRUE AND is_visible = TRUE LIMIT 1`,
      );
      const path = rows.length > 0 && rows[0].path ? rows[0].path : '/dashboard';
      return NextResponse.json({ path });
    } finally {
      await prisma.$disconnect();
    }
  } catch {
    return NextResponse.json({ path: '/dashboard' });
  }
}
