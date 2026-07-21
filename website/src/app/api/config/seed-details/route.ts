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
