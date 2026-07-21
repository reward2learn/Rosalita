/**
 * Clear Seeded Data API
 *
 * POST /api/admin/clear-seed
 *   Deletes all seeded content from the database so the admin can
 *   re-upload and re-seed from scratch.
 *
 *   Preserves operational data: Z-reports, conversations, user accounts,
 *   security groups, secrets, app settings, and PDF jobs.
 *
 *   Body: { confirm?: string } — must pass `confirm: "CLEAR ALL SEEDED DATA"`
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

const clearSchema = z.object({
  confirm: z.literal('CLEAR ALL SEEDED DATA'),
});

/** Tables that hold seeded content — deleted in dependency order. */
const SEED_TABLES = [
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
] as const;

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  // Validate confirmation token
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = clearSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(
      'Send { "confirm": "CLEAR ALL SEEDED DATA" } to confirm deletion. This cannot be undone.',
      400,
    );
  }

  const connStr = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!connStr) {
    return jsonError('POSTGRES_URL not configured', 500);
  }

  const prisma = new PrismaClient({ datasources: { db: { url: connStr } } });

  try {
    const deleted: Record<string, number> = {};

    // Delete in reverse-dependency order (child tables first, then parents)
    for (const table of SEED_TABLES) {
      try {
        // Use raw SQL for tables that may not have a Prisma model, or
        // the model-based delete for those that do.
        const result = await prisma.$executeRawUnsafe(`DELETE FROM "${table}"`);
        deleted[table] = Number(result);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.warn(`[clear-seed] Table "${table}" delete failed (may not exist): ${message}`);
        deleted[table] = -1; // signifies error / doesn't exist
      }
    }

    // Also clear the dynamic pages registry so fresh pages are generated on next seed
    const { setDynamicPages } = await import('@/lib/page-catalog');
    setDynamicPages([]);

    console.log('[clear-seed] Seeded data cleared:', JSON.stringify(deleted));

    return jsonOk({
      deleted,
      message: 'All seeded data has been cleared. Upload a new workbook via the Config page and re-seed.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(`Clear failed: ${message}`, 500);
  } finally {
    await prisma.$disconnect();
  }
}
