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
    'monthly_targets', 'levers', 'action_items', 'daily_z_reports',
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
    } else if (table === 'daily_z_reports') {
      for (const row of data) {
        if (!row.report_date && !row.reportDate) continue;
        await prisma.$executeRawUnsafe(
          `INSERT INTO daily_z_reports (
            id, report_date, department, report_time, operator, report_no,
            pos_group, period_start, period_end,
            item_sales_qty, item_sales_amount, item_discount_qty, item_discount_amount,
            bill_discount_qty, bill_discount_amount, foc_items_qty, foc_items_amount,
            foc_bill_qty, foc_bill_amount, total_sales, estimated_sales,
            cash_qty, cash_amount, bca_qty, bca_amount,
            gojek_pay_qty, gojek_pay_amount, mandiri_qty, mandiri_amount,
            total_card_qty, total_card_amount, total_cash_qty, total_cash_amount,
            refund_qty, refund_amount, pre_send_void_qty, pre_send_void_amount,
            post_send_void_qty, post_send_void_amount, tot_collection_qty, tot_collection_amount,
            tax_10_amount, service_7_amount, nett_sales,
            bills_pending_qty, bills_pending_amount, total_bills, avg_bills,
            total_covers, avg_covers, begin_receipt_no, end_receipt_no,
            group_beverage_qty, group_beverage_amount, group_food_qty, group_food_amount,
            group_total_qty, group_total_amount,
            group_foc_beverage_qty, group_foc_beverage_amount, group_foc_food_qty, group_foc_food_amount,
            dine_in_qty, dine_in_amount, gofood_qty, gofood_amount,
            total_ctgry_qty, total_ctgry_amount, bill_disc_20_qty, bill_disc_20_amount,
            total_item_discount_qty, total_item_discount_amount,
            raw_text, entry_source, receipt_images
          ) VALUES (
            $1, $2::date, $3, $4::time, $5, $6, $7, $8::timestamp, $9::timestamp,
            $10, $11, $12, $13, $14, $15, $16,
            $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28,
            $29, $30, $31, $32, $33, $34, $35, $36,
            $37, $38, $39, $40,
            $41, $42, $43,
            $44, $45, $46, $47,
            $48, $49, $50, $51,
            $52, $53, $54, $55, $56, $57,
            $58, $59, $60, $61, $62, $63,
            $64, $65, $66, $67, $68, $69, $70,
            $71, $72, $73, $74, $75::jsonb
          )
          ON CONFLICT (id) DO UPDATE SET
            report_date = $2::date, department = $3, nett_sales = $44, receipt_images = $75::jsonb`,
          Number(row.id ?? 0),
          String(row.report_date ?? row.reportDate ?? ''),
          String(row.department ?? ''),
          (() => {
            const t = row.report_time ?? row.reportTime;
            if (!t) return null;
            const s = String(t);
            return s.includes('T') ? s.split('T')[1]?.slice(0, 8) : s.slice(0, 8);
          })(),
          String(row.operator ?? ''),
          Number(row.report_no ?? row.reportNo ?? 0),
          String(row.pos_group ?? row.posGroup ?? ''),
          (() => {
            const t = row.period_start ?? row.periodStart;
            return t ? String(t).includes('T') ? String(t).replace('T', ' ') : String(t) : null;
          })(),
          (() => {
            const t = row.period_end ?? row.periodEnd;
            return t ? String(t).includes('T') ? String(t).replace('T', ' ') : String(t) : null;
          })(),
          Number(row.item_sales_qty ?? row.itemSalesQty ?? 0),
          Number(row.item_sales_amount ?? row.itemSalesAmount ?? 0),
          Number(row.item_discount_qty ?? row.itemDiscountQty ?? 0),
          Number(row.item_discount_amount ?? row.itemDiscountAmount ?? 0),
          Number(row.bill_discount_qty ?? row.billDiscountQty ?? 0),
          Number(row.bill_discount_amount ?? row.billDiscountAmount ?? 0),
          Number(row.foc_items_qty ?? row.focItemsQty ?? 0),
          Number(row.foc_items_amount ?? row.focItemsAmount ?? 0),
          Number(row.foc_bill_qty ?? row.focBillQty ?? 0),
          Number(row.foc_bill_amount ?? row.focBillAmount ?? 0),
          Number(row.total_sales ?? row.totalSales ?? 0),
          Number(row.estimated_sales ?? row.estimatedSales ?? 0),
          Number(row.cash_qty ?? row.cashQty ?? 0),
          Number(row.cash_amount ?? row.cashAmount ?? 0),
          Number(row.bca_qty ?? row.bcaQty ?? 0),
          Number(row.bca_amount ?? row.bcaAmount ?? 0),
          Number(row.gojek_pay_qty ?? row.gojekPayQty ?? 0),
          Number(row.gojek_pay_amount ?? row.gojekPayAmount ?? 0),
          Number(row.mandiri_qty ?? row.mandiriQty ?? 0),
          Number(row.mandiri_amount ?? row.mandiriAmount ?? 0),
          Number(row.total_card_qty ?? row.totalCardQty ?? 0),
          Number(row.total_card_amount ?? row.totalCardAmount ?? 0),
          Number(row.total_cash_qty ?? row.totalCashQty ?? 0),
          Number(row.total_cash_amount ?? row.totalCashAmount ?? 0),
          Number(row.refund_qty ?? row.refundQty ?? 0),
          Number(row.refund_amount ?? row.refundAmount ?? 0),
          Number(row.pre_send_void_qty ?? row.preSendVoidQty ?? 0),
          Number(row.pre_send_void_amount ?? row.preSendVoidAmount ?? 0),
          Number(row.post_send_void_qty ?? row.postSendVoidQty ?? 0),
          Number(row.post_send_void_amount ?? row.postSendVoidAmount ?? 0),
          Number(row.tot_collection_qty ?? row.totCollectionQty ?? 0),
          Number(row.tot_collection_amount ?? row.totCollectionAmount ?? 0),
          Number(row.tax_10_amount ?? row.tax10Amount ?? 0),
          Number(row.service_7_amount ?? row.service7Amount ?? 0),
          Number(row.nett_sales ?? row.nettSales ?? 0),
          Number(row.bills_pending_qty ?? row.billsPendingQty ?? 0),
          Number(row.bills_pending_amount ?? row.billsPendingAmount ?? 0),
          Number(row.total_bills ?? row.totalBills ?? 0),
          Number(row.avg_bills ?? row.avgBills ?? 0),
          Number(row.total_covers ?? row.totalCovers ?? 0),
          Number(row.avg_covers ?? row.avgCovers ?? 0),
          String(row.begin_receipt_no ?? row.beginReceiptNo ?? ''),
          String(row.end_receipt_no ?? row.endReceiptNo ?? ''),
          Number(row.group_beverage_qty ?? row.groupBeverageQty ?? 0),
          Number(row.group_beverage_amount ?? row.groupBeverageAmount ?? 0),
          Number(row.group_food_qty ?? row.groupFoodQty ?? 0),
          Number(row.group_food_amount ?? row.groupFoodAmount ?? 0),
          Number(row.group_total_qty ?? row.groupTotalQty ?? 0),
          Number(row.group_total_amount ?? row.groupTotalAmount ?? 0),
          Number(row.group_foc_beverage_qty ?? row.groupFocBeverageQty ?? 0),
          Number(row.group_foc_beverage_amount ?? row.groupFocBeverageAmount ?? 0),
          Number(row.group_foc_food_qty ?? row.groupFocFoodQty ?? 0),
          Number(row.group_foc_food_amount ?? row.groupFocFoodAmount ?? 0),
          Number(row.dine_in_qty ?? row.dineInQty ?? 0),
          Number(row.dine_in_amount ?? row.dineInAmount ?? 0),
          Number(row.gofood_qty ?? row.gofoodQty ?? 0),
          Number(row.gofood_amount ?? row.gofoodAmount ?? 0),
          Number(row.total_ctgry_qty ?? row.totalCtgryQty ?? 0),
          Number(row.total_ctgry_amount ?? row.totalCtgryAmount ?? 0),
          Number(row.bill_disc_20_qty ?? row.billDisc20Qty ?? 0),
          Number(row.bill_disc_20_amount ?? row.billDisc20Amount ?? 0),
          Number(row.total_item_discount_qty ?? row.totalItemDiscountQty ?? 0),
          Number(row.total_item_discount_amount ?? row.totalItemDiscountAmount ?? 0),
          String(row.raw_text ?? row.rawText ?? ''),
          String(row.entry_source ?? row.entrySource ?? 'imported'),
          row.receipt_images ? JSON.stringify(row.receipt_images) : '[]',
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
