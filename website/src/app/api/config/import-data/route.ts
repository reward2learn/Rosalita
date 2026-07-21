/**
 * Import Data API
 *
 * POST /api/config/import-data
 *   Accepts JSON body with category data and upserts into the appropriate tables.
 *
 *   Body: { category: string, data: unknown[] }
 *   Where category is one of: review_parts, snippets, tasks, roles, targets, levers, action_items
 *
 *   Returns: { imported: number }
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { PrismaClient } from '@/generated/prisma';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const importSchema = z.object({
  table: z.enum([
    'business_review_parts', 'knowledge_snippets', 'tasks', 'roles',
    'monthly_targets', 'levers', 'action_items',
  ]),
  data: z.array(z.record(z.unknown())),
});

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch { return jsonError('Invalid JSON', 400); }
  const parsed = importSchema.safeParse(body);
  if (!parsed.success) return jsonError('Invalid schema: ' + JSON.stringify(parsed.error.flatten()), 400);

  const { table, data } = parsed.data;
  if (data.length === 0) return jsonOk({ imported: 0 });

  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) return jsonError('POSTGRES_URL not configured', 500);

  const prisma = new PrismaClient({ datasources: { db: { url } } });

  try {
    let imported = 0;

    if (table === 'knowledge_snippets') {
      for (const row of data) {
        if (!row.key || !row.content) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO knowledge_snippets (id, key, category, content)
           VALUES (gen_random_uuid()::text, $1, $2, $3)
           ON CONFLICT (key) DO UPDATE SET category = $2, content = $3`,
          String(row.key), String(row.category ?? 'imported'), String(row.content),
        );
        imported++;
      }
    } else if (table === 'monthly_targets') {
      for (const row of data) {
        if (!row.month) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO monthly_targets (id, month, target_revenue, target_ebitda, target_guests, target_avg_spend, target_staff_cost_pct)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
           ON CONFLICT (month) DO UPDATE SET target_revenue = $2, target_ebitda = $3, target_guests = $4, target_avg_spend = $5, target_staff_cost_pct = $6`,
          String(row.month),
          Number(row.targetRevenue ?? row.target_revenue ?? 0),
          Number(row.targetEbitda ?? row.target_ebitda ?? 0),
          Number(row.targetGuests ?? row.target_guests ?? 0),
          Number(row.targetAvgSpend ?? row.target_avg_spend ?? 0),
          Number(row.targetStaffCostPct ?? row.target_staff_cost_pct ?? 0),
        );
        imported++;
      }
    } else if (table === 'levers') {
      for (const row of data) {
        if (!row.num || !row.name) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO levers (id, num, name, impact, description)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4)
           ON CONFLICT (num) DO UPDATE SET name = $2, impact = $3, description = $4`,
          Number(row.num), String(row.name), String(row.impact ?? ''), String(row.description ?? ''),
        );
        imported++;
      }
    } else if (table === 'action_items') {
      for (const row of data) {
        if (!row.label) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO action_items (id, priority, label, completed, sort_order)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4)`,
          String(row.priority ?? 'P1'), String(row.label), Boolean(row.completed ?? false), Number(row.sortOrder ?? 0),
        );
        imported++;
      }
    } else if (table === 'roles') {
      for (const row of data) {
        if (!row.code || !row.name) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO roles (id, code, name, email)
           VALUES (gen_random_uuid()::text, $1, $2, $3)
           ON CONFLICT (code) DO UPDATE SET name = $2, email = $3`,
          String(row.code), String(row.name), row.email ? String(row.email) : null,
        );
        imported++;
      }
    } else if (table === 'tasks') {
      for (const row of data) {
        if (!row.title) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO tasks (id, title, description, priority, status, sort_order)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5)`,
          String(row.title), String(row.description ?? ''), String(row.priority ?? 'P1'), String(row.status ?? 'pending'), Number(row.sortOrder ?? 0),
        );
        imported++;
      }
    } else if (table === 'business_review_parts') {
      for (const row of data) {
        if (!row.slug || !row.markdown) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO business_review_parts (id, part_key, slug, title, sort_order, auth_tier, markdown)
           VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6)
           ON CONFLICT (slug) DO UPDATE SET title = $3, sort_order = $4, markdown = $6`,
          String(row.partKey ?? ''), String(row.slug), String(row.title ?? ''), Number(row.sortOrder ?? 0), String(row.authTier ?? 'google'), String(row.markdown),
        );
        imported++;
      }
    }

    return jsonOk({ imported });
  } catch (err) {
    return jsonError(`Import failed: ${err instanceof Error ? err.message : String(err)}`, 500);
  } finally {
    await prisma.$disconnect();
  }
}
