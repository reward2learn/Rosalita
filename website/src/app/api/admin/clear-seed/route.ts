/**
 * Clear Seeded Data API
 *
 * POST /api/admin/clear-seed
 *   Deletes seeded content from the database.
 *
 *   Body (full clear):
 *     { "confirm": "CLEAR ALL SEEDED DATA" }
 *     Deletes ALL seed tables.
 *
 *   Body (targeted clear):
 *     { "tables": ["business_review_parts", "knowledge_snippets"], "confirm": "CLEAR SELECTED" }
 *     Deletes only the specified tables (must include confirm string "CLEAR SELECTED").
 *
 *   Preserves operational data: Z-reports, conversations, user accounts,
 *   security groups, secrets, app settings, and PDF jobs.
 *
 *   Returns: { deleted: Record<string, number> } — counts per table
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@/generated/prisma';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const tableNames = [
  'page_sections',
  'app_pages',
  'task_assignments',
  'tasks',
  'roles',
  'action_items',
  'levers',
  'monthly_targets',
  'daily_metrics',
  'monthly_actual_departments',
  'monthly_actual_inputs',
  'business_review_parts',
  'knowledge_snippets',
  'financial_projections',
  'navigation_items',
  'daily_z_reports',
] as const;

const clearSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('all'), confirm: z.literal('CLEAR ALL SEEDED DATA') }),
  z.object({
    mode: z.literal('selected'),
    tables: z.array(z.enum(tableNames)).min(1),
    confirm: z.literal('CLEAR SELECTED'),
  }),
]);

export type ClearMode = 'all' | 'selected';

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON body', 400); }

  const parsed = clearSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'Send { "mode": "all", "confirm": "CLEAR ALL SEEDED DATA" } or ' +
      '{ "mode": "selected", "tables": [...], "confirm": "CLEAR SELECTED" }',
      400,
    );
  }

  const tablesToDelete: readonly string[] = parsed.data.mode === 'all'
    ? tableNames
    : parsed.data.tables;

  const connStr = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connStr) return jsonError('POSTGRES_URL not configured', 500);

  const prisma = new PrismaClient({ datasources: { db: { url: connStr } } });

  try {
    const deleted: Record<string, number> = {};

    // Delete in reverse-dependency order
    const orderedTables = tableNames.filter((t) => tablesToDelete.includes(t));
    for (const table of orderedTables) {
      try {
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        deleted[table] = Number(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[clear-seed] Table "${table}" delete failed: ${message}`);
        deleted[table] = -1;
      }
    }

    // Clear in-memory catalogs so nav and review reflect the empty DB
    {
      const { setDynamicPages, setDynamicReviewParts } = await import('@/lib/page-catalog');
      setDynamicPages([]);
      setDynamicReviewParts([]);
    }

    console.log('[clear-seed] Cleared:', JSON.stringify(deleted));

    return jsonOk({
      deleted,
      message: parsed.data.mode === 'all'
        ? 'All seeded data has been cleared.'
        : `Selected tables cleared: ${parsed.data.tables.join(', ')}`,
    });
  } catch (err) {
    return jsonError(`Clear failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    await prisma.$disconnect();
  }
}
