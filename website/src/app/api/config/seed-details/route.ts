/**
 * Seed Details API
 *
 * GET /api/config/seed-details
 *   Returns detailed information about what was seeded in the database:
 *   - All app pages with their sections
 *   - Business Review parts (+ Executive Summary)
 *   - Knowledge snippets
 *   - Tasks with role assignments
 *   - Roles
 *   - Monthly targets
 *   - Levers
 *   - Action items
 *   - Daily Z-reports
 *
 *   Uses a direct PrismaClient (not the enhanced ZenStack client) so that
 *   policy-restricted models (e.g. Lever, ActionItem, KnowledgeSnippet)
 *   are fully readable by platform admins.
 *
 *   Also returns per-table counts and a seed-status summary with any
 *   warnings or errors recorded during the last seed.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import type { AuthTier } from '@/lib/page-catalog';

export const dynamic = 'force-dynamic';

function getClient() {
  const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error('POSTGRES_URL is not set');
  return new PrismaClient({ datasources: { db: { url } } });
}

export async function GET(): Promise<NextResponse> {
  const prisma = getClient();

  try {
    // ── App pages (with sections) ────────────────────────
    const appPages = await prisma.appPage.findMany({
      orderBy: { sortOrder: 'asc' },
      include: { sections: { orderBy: { sortOrder: 'asc' } } },
    });

    const pageDetails = appPages.map((p) => ({
      slug: p.slug,
      title: p.title,
      authTier: p.authTier,
      sectionCount: p.sections.length,
      sections: p.sections.map((s) => ({
        blockType: s.blockType,
        sortOrder: s.sortOrder,
      })),
    }));

    const pageSectionCount = appPages.reduce((n, p) => n + p.sections.length, 0);

    // ── Business Review parts ────────────────────────────
    const reviewParts = await prisma.businessReviewPart.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    const reviewPartDetails = reviewParts.map((p) => ({
      slug: p.slug,
      title: p.title,
      partKey: p.partKey,
      markdownLength: p.markdown.length,
      markdownPreview: p.markdown.slice(0, 500) + (p.markdown.length > 500 ? '...' : ''),
    }));

    // ── Knowledge snippets ───────────────────────────────
    const snippets = await prisma.knowledgeSnippet.findMany({
      orderBy: { key: 'asc' },
    });

    const snippetDetails = snippets.map((s) => ({
      key: s.key,
      category: s.category,
      contentLength: s.content.length,
      contentPreview: s.content.slice(0, 200) + (s.content.length > 200 ? '...' : ''),
    }));

    // ── Tasks (with assignments + role names) ────────────
    const tasks = await prisma.task.findMany({
      orderBy: { sortOrder: 'asc' },
      include: {
        assignments: {
          include: { role: true },
        },
      },
    });

    const taskDetails = tasks.map((t) => ({
      title: t.title,
      priority: t.priority,
      status: t.status,
      roles: t.assignments.map((a) => a.role.name),
    }));

    // ── Roles ────────────────────────────────────────────
    const roleRecords = await prisma.role.findMany({ orderBy: { code: 'asc' } });
    const roleDetails = roleRecords.map((r) => ({
      code: r.code,
      name: r.name,
      email: r.email,
    }));

    // ── Monthly targets ──────────────────────────────────
    const targets = await prisma.monthlyTarget.findMany({ orderBy: { month: 'asc' } });
    const targetDetails = targets.map((t) => ({
      month: t.month,
      targetRevenue: t.targetRevenue,
      targetEbitda: t.targetEbitda,
      targetGuests: t.targetGuests,
    }));

    // ── Levers ────────────────────────────────────────────
    const leverRecords = await prisma.lever.findMany({ orderBy: { num: 'asc' } });
    const leverDetails = leverRecords.map((l) => ({
      num: l.num,
      name: l.name,
      impact: l.impact,
    }));

    // ── Action items ─────────────────────────────────────
    const actionItemRecords = await prisma.actionItem.findMany({ orderBy: { sortOrder: 'asc' } });
    const actionItemDetails = actionItemRecords.map((a) => ({
      priority: a.priority,
      label: a.label,
      completed: a.completed,
    }));

    // ── Daily Z-reports ───────────────────────────────────
    const zReports = await prisma.dailyZReport.findMany({
      orderBy: { reportDate: 'desc' },
      take: 200,
    });

    const zReportDetails = zReports.map((z) => ({
      id: z.id,
      report_date: z.reportDate.toISOString().slice(0, 10),
      department: z.department,
      report_time: z.reportTime?.toISOString().slice(0, 16) ?? null,
      operator: z.operator,
      report_no: z.reportNo,
      pos_group: z.posGroup,
      period_start: z.periodStart?.toISOString().slice(0, 16) ?? null,
      period_end: z.periodEnd?.toISOString().slice(0, 16) ?? null,
      item_sales_qty: z.itemSalesQty,
      item_sales_amount: z.itemSalesAmount.toString(),
      item_discount_qty: z.itemDiscountQty,
      item_discount_amount: z.itemDiscountAmount.toString(),
      bill_discount_qty: z.billDiscountQty,
      bill_discount_amount: z.billDiscountAmount.toString(),
      foc_items_qty: z.focItemsQty,
      foc_items_amount: z.focItemsAmount.toString(),
      foc_bill_qty: z.focBillQty,
      foc_bill_amount: z.focBillAmount.toString(),
      total_sales: z.totalSales.toString(),
      estimated_sales: z.estimatedSales.toString(),
      cash_qty: z.cashQty,
      cash_amount: z.cashAmount.toString(),
      bca_qty: z.bcaQty,
      bca_amount: z.bcaAmount.toString(),
      gojek_pay_qty: z.gojekPayQty,
      gojek_pay_amount: z.gojekPayAmount.toString(),
      mandiri_qty: z.mandiriQty,
      mandiri_amount: z.mandiriAmount.toString(),
      total_card_qty: z.totalCardQty,
      total_card_amount: z.totalCardAmount.toString(),
      total_cash_qty: z.totalCashQty,
      total_cash_amount: z.totalCashAmount.toString(),
      refund_qty: z.refundQty,
      refund_amount: z.refundAmount.toString(),
      pre_send_void_qty: z.preSendVoidQty,
      pre_send_void_amount: z.preSendVoidAmount.toString(),
      post_send_void_qty: z.postSendVoidQty,
      post_send_void_amount: z.postSendVoidAmount.toString(),
      tot_collection_qty: z.totCollectionQty,
      tot_collection_amount: z.totCollectionAmount.toString(),
      tax_10_amount: z.tax10Amount.toString(),
      service_7_amount: z.service7Amount.toString(),
      nett_sales: z.nettSales.toString(),
      bills_pending_qty: z.billsPendingQty,
      bills_pending_amount: z.billsPendingAmount.toString(),
      total_bills: z.totalBills,
      avg_bills: z.avgBills.toString(),
      total_covers: z.totalCovers,
      avg_covers: z.avgCovers.toString(),
      begin_receipt_no: z.beginReceiptNo,
      end_receipt_no: z.endReceiptNo,
      group_beverage_qty: z.groupBeverageQty,
      group_beverage_amount: z.groupBeverageAmount.toString(),
      group_food_qty: z.groupFoodQty,
      group_food_amount: z.groupFoodAmount.toString(),
      group_total_qty: z.groupTotalQty,
      group_total_amount: z.groupTotalAmount.toString(),
      group_foc_beverage_qty: z.groupFocBeverageQty,
      group_foc_beverage_amount: z.groupFocBeverageAmount.toString(),
      group_foc_food_qty: z.groupFocFoodQty,
      group_foc_food_amount: z.groupFocFoodAmount.toString(),
      dine_in_qty: z.dineInQty,
      dine_in_amount: z.dineInAmount.toString(),
      gofood_qty: z.gofoodQty,
      gofood_amount: z.gofoodAmount.toString(),
      total_ctgry_qty: z.totalCtgryQty,
      total_ctgry_amount: z.totalCtgryAmount.toString(),
      bill_disc_20_qty: z.billDisc20Qty,
      bill_disc_20_amount: z.billDisc20Amount.toString(),
      total_item_discount_qty: z.totalItemDiscountQty,
      total_item_discount_amount: z.totalItemDiscountAmount.toString(),
      raw_text: z.rawText,
      entry_source: z.entrySource,
      receipt_images: z.receiptImages,
    }));

    // ── Counts ────────────────────────────────────────────
    const counts: Record<string, number> = {
      appPages: appPages.length,
      pageSections: pageSectionCount,
      businessReviewParts: reviewParts.length,
      knowledgeSnippets: snippets.length,
      tasks: tasks.length,
      roles: roleRecords.length,
      monthlyTargets: targets.length,
      levers: leverRecords.length,
      actionItems: actionItemRecords.length,
      dailyZReports: zReports.length,
    };

    // ── Executive Summary from knowledge snippets ────────
    const execSummarySnippet = snippets.find((s) => s.key === 'executive_summary');

    // ── Seed status / warnings ───────────────────────────
    const warnings: string[] = [];
    if (reviewParts.length === 0) {
      warnings.push('No Business Review parts found. Use the AI Content Generation tab to generate them.');
    }
    if (!execSummarySnippet) {
      warnings.push('No Executive Summary found. Use the AI Content Generation tab to generate it.');
    }
    if (appPages.length === 0) {
      warnings.push('No app pages seeded. The navigation may be empty.');
    }

    return NextResponse.json({
      success: true,
      counts,
      pageDetails,
      reviewPartDetails,
      snippetDetails,
      taskDetails,
      roleDetails,
      targetDetails,
      leverDetails,
      actionItemDetails,
      zReportDetails,
      executiveSummary: execSummarySnippet?.content ?? null,
      seedStatus: {
        ok: warnings.length === 0,
        warnings,
        totalTables: Object.keys(counts).length,
        totalRows: Object.values(counts).reduce((s, c) => s + c, 0),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  } finally {
    await prisma.$disconnect();
  }
}
