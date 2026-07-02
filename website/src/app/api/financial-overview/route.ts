/**
 * Financial overview API — legacy reference: website/api/financial-overview.js
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import {
  FinancialProjectionService,
  SCENARIO_MAP,
  type ForecastScenarioKey,
} from '@/domain/financial/financial-projection-service';
import { MonthlyActualsService } from '@/domain/actuals/monthly-actuals-service';
import {
  ACTUALS_COST_DEPARTMENTS,
  getActualsDepartment,
  sectionForDepartment,
} from '@/domain/actuals/monthly-actuals-schema';
import {
  buildComputedPnl,
  computedPreview,
  COMPUTED_PREVIEW_KEYS,
  isExcelLedgerMonth,
  MANUAL_INPUT_SECTIONS,
} from '@/domain/financial/pnl-calculator';
import { SyncMonthlyActuals } from '@/domain/actuals/sync-monthly-actuals';
import { MonthlyActualsPrefill } from '@/domain/actuals/monthly-actuals-prefill';
import { legacyError } from '@/lib/api/response';

const monthlyActualsPostSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/),
  department: z.string().optional(),
  inputs: z.record(z.unknown()).optional(),
  receipt_images: z.unknown().optional(),
  notes: z.string().optional(),
  inputs_only: z.boolean().optional(),
  save_mode: z.string().optional(),
});

function inputsForDepartment(consolidated: Record<string, number>, department: string) {
  const keys = new Set(getActualsDepartment(department)?.fields.map((f) => f.key) || []);
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(consolidated || {})) {
    if (keys.has(k)) out[k] = v;
  }
  return out;
}

async function buildMonthlyActualsPayload(
  service: MonthlyActualsService,
  sync: SyncMonthlyActuals,
  prefillHelper: MonthlyActualsPrefill,
  period: string,
  departmentId: string | null,
) {
  const excelLocked = isExcelLedgerMonth(period);
  const manualInputs = excelLocked ? {} : await service.getManualInputs(period);
  const zAgg = await sync.aggregateZReportsForMonth(period);
  const ytdBefore = excelLocked ? null : await sync.getYtdTotalsBefore(period);
  const values = buildComputedPnl(period, zAgg, manualInputs, ytdBefore);
  const department_statuses = excelLocked ? [] : await service.getDepartmentStatuses(period);

  const activeDept = departmentId && getActualsDepartment(departmentId) ? departmentId : 'direct';

  let deptPayload = null;
  if (!excelLocked && getActualsDepartment(activeDept)) {
    const record = await service.getDepartmentRecord(period, activeDept);
    deptPayload = {
      department: activeDept,
      section: sectionForDepartment(activeDept),
      inputs: record?.inputs || inputsForDepartment(manualInputs, activeDept),
      receipt_images: record?.receipt_images || [],
      notes: record?.notes || '',
      saved: !!record,
    };
  }

  return {
    period,
    excel_locked: excelLocked,
    sections: MANUAL_INPUT_SECTIONS,
    departments: ACTUALS_COST_DEPARTMENTS.map((d) => ({
      id: d.id,
      label: d.label,
      shortLabel: d.shortLabel,
      description: d.description,
    })),
    department_statuses,
    inputs: manualInputs,
    department_detail: deptPayload,
    z_aggregate: zAgg,
    computed_preview: computedPreview(values),
    computed_preview_keys: COMPUTED_PREVIEW_KEYS,
    excel_source: excelLocked,
  };
}

async function handleMonthlyActuals(request: Request, url: URL): Promise<NextResponse> {
  const db = createClient();
  const service = new MonthlyActualsService(db);
  const sync = new SyncMonthlyActuals(db);
  const prefillHelper = new MonthlyActualsPrefill(db);

  if (request.method === 'GET') {
    if (url.searchParams.get('recent') === '1' || url.searchParams.get('recent') === 'true') {
      const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10) || 10));
      const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
      const offset = (page - 1) * limit;
      const { rows, total } = await service.listRecentActualsEntries(limit, offset);
      return NextResponse.json({
        success: true,
        data: {
          rows,
          pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
        },
      });
    }

    const period = url.searchParams.get('period');
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return legacyError('period=YYYY-MM required', 400);
    }

    const needsPrefill = url.searchParams.get('prefill') === '1' || url.searchParams.get('prefill') === 'true';
    if (needsPrefill) {
      const guard = await requireWriteAuth(request);
      if (!guard.ok) return guard.response;
    }

    if (isExcelLedgerMonth(period) && needsPrefill) {
      return legacyError('Jan–May 2026 actuals are sourced from Excel and cannot be prefilled here.', 400);
    }

    const departmentId = String(url.searchParams.get('department') || '').trim() || null;
    const payload = await buildMonthlyActualsPayload(service, sync, prefillHelper, period, departmentId);

    if (needsPrefill) {
      const fromPeriod = String(url.searchParams.get('prefill_from') || '').trim();
      const prefillOpts = /^\d{4}-\d{2}$/.test(fromPeriod) ? { fromPeriod } : {};
      const prefill = await prefillHelper.buildPrefillInputs(period, payload.z_aggregate, prefillOpts);
      const scope = url.searchParams.get('scope') === 'month' ? 'month' : 'dept';
      const ytdBefore = await sync.getYtdTotalsBefore(period);

      if (scope === 'month') {
        const hasSaved = payload.inputs && Object.keys(payload.inputs).length > 0;
        const useInputs = hasSaved && url.searchParams.get('prefill_mode') !== 'replace'
          ? { ...prefill.inputs, ...payload.inputs }
          : prefill.inputs;
        const values = buildComputedPnl(period, payload.z_aggregate, useInputs, ytdBefore);
        return NextResponse.json({
          success: true,
          data: {
            ...payload,
            inputs: useInputs,
            prefill: prefill.prefill_meta,
            computed_preview: computedPreview(values),
            prefilled: true,
            prefill_scope: 'month',
          },
        });
      }

      const dept = departmentId || 'direct';
      const deptKeys = new Set(getActualsDepartment(dept)?.fields.map((f) => f.key) || []);
      const deptPrefill: Record<string, number> = {};
      for (const [k, v] of Object.entries(prefill.inputs)) {
        if (deptKeys.has(k)) deptPrefill[k] = v;
      }

      const existingDept = payload.department_detail?.inputs || {};
      const hasSaved = existingDept && Object.keys(existingDept).length > 0;
      const useDeptInputs = hasSaved && url.searchParams.get('prefill_mode') !== 'replace'
        ? { ...deptPrefill, ...existingDept }
        : deptPrefill;

      const mergedMonth = { ...payload.inputs, ...useDeptInputs };
      const values = buildComputedPnl(period, payload.z_aggregate, mergedMonth, ytdBefore);

      return NextResponse.json({
        success: true,
        data: {
          ...payload,
          inputs: mergedMonth,
          department_detail: {
            ...(payload.department_detail || { department: dept, section: sectionForDepartment(dept) }),
            inputs: useDeptInputs,
          },
          prefill: prefill.prefill_meta,
          computed_preview: computedPreview(values),
          prefilled: true,
          prefill_scope: 'dept',
        },
      });
    }

    return NextResponse.json({ success: true, data: payload });
  }

  if (request.method === 'POST') {
    const guard = await requireWriteAuth(request);
    if (!guard.ok) return guard.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return legacyError('Invalid JSON body', 400);
    }

    const parsed = monthlyActualsPostSchema.safeParse(body);
    if (!parsed.success) {
      return legacyError('period (YYYY-MM) required', 400);
    }

    const { period, department, inputs, receipt_images, notes, inputs_only, save_mode } = parsed.data;
    const writeDb = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    const writeService = new MonthlyActualsService(writeDb);

    if (isExcelLedgerMonth(period)) {
      return legacyError('Jan–May 2026 actuals are sourced from Excel and cannot be edited here.', 400);
    }

    try {
      if (department) {
        const inputsOnly = inputs_only === true || save_mode === 'costs';
        const saved = inputsOnly
          ? await writeService.saveDepartmentInputsOnly(period, department, { inputs: inputs ?? {} })
          : await writeService.saveDepartmentRecord(period, department, {
              inputs: inputs ?? {},
              receipt_images,
              notes,
            });

        const payload = await buildMonthlyActualsPayload(
          writeService,
          new SyncMonthlyActuals(writeDb),
          new MonthlyActualsPrefill(writeDb),
          period,
          department,
        );
        return NextResponse.json({
          success: true,
          data: { ...payload, synced: true, saved_department: department, department_saved: saved },
        });
      }

      await writeService.saveManualInputs(period, inputs ?? {});
      const payload = await buildMonthlyActualsPayload(
        writeService,
        new SyncMonthlyActuals(writeDb),
        new MonthlyActualsPrefill(writeDb),
        period,
        null,
      );
      return NextResponse.json({ success: true, data: { ...payload, synced: true } });
    } catch (err) {
      console.error('[monthly-actuals POST]', err);
      return legacyError(err instanceof Error ? err.message : 'Server error', 500);
    }
  }

  return legacyError('Method not allowed', 405);
}

function toJsonNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'object' && value !== null && 'toString' in value) {
    const n = Number(String(value));
    return Number.isNaN(n) ? null : n;
  }
  return null;
}

function serializeReportRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      out[key] = value.toISOString().slice(0, 10);
    } else if (typeof value === 'bigint') {
      out[key] = Number(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function handleReports(url: URL): Promise<NextResponse> {
  const period = url.searchParams.get('period') ?? 'monthly';
  const resource = url.searchParams.get('resource');
  const db = createClient();

  try {
    if (resource === 'targets') {
      const targets = await db.monthlyTarget.findMany({ orderBy: { month: 'asc' } });
      return NextResponse.json({ success: true, data: targets });
    }

    let metrics;
    if (period === 'daily') {
      metrics = await db.dailyZReport.findMany({
        orderBy: { reportDate: 'asc' },
        select: {
          reportDate: true,
          nettSales: true,
          totalCovers: true,
          avgCovers: true,
          totalBills: true,
          gofoodAmount: true,
          dineInAmount: true,
          totCollectionAmount: true,
          totalSales: true,
          tax10Amount: true,
          service7Amount: true,
        },
      });
      return NextResponse.json({
        success: true,
        data: {
          period,
          metrics: metrics.map((r) => ({
            date: r.reportDate.toISOString().slice(0, 10),
            revenue: toJsonNumber(r.nettSales),
            guests_count: toJsonNumber(r.totalCovers),
            avg_spend: r.avgCovers,
            total_bills: toJsonNumber(r.totalBills),
            gofood_revenue: toJsonNumber(r.gofoodAmount),
            direct_orders: toJsonNumber(r.dineInAmount),
            tot_collection_amount: toJsonNumber(r.totCollectionAmount),
            total_sales: toJsonNumber(r.totalSales),
            tax_10_amount: toJsonNumber(r.tax10Amount),
            service_7_amount: toJsonNumber(r.service7Amount),
          })),
          targets: await db.monthlyTarget.findMany({ orderBy: { month: 'asc' } }),
        },
      });
    }

    if (period === 'weekly') {
      const rows = await db.$queryRaw<
        {
          period_start: Date;
          revenue: bigint | number | null;
          guests_count: bigint | number | null;
          avg_spend: number | null;
          total_bills: bigint | number | null;
          gofood_revenue: bigint | number | null;
          direct_orders: bigint | number | null;
          tot_collection_amount: bigint | number | null;
        }[]
      >`
        SELECT
          DATE_TRUNC('week', report_date)::date AS period_start,
          SUM(nett_sales) AS revenue,
          SUM(total_covers) AS guests_count,
          ROUND(AVG(avg_covers)) AS avg_spend,
          SUM(total_bills) AS total_bills,
          SUM(gofood_amount) AS gofood_revenue,
          SUM(dine_in_amount) AS direct_orders,
          SUM(tot_collection_amount) AS tot_collection_amount
        FROM daily_z_reports
        GROUP BY DATE_TRUNC('week', report_date)
        ORDER BY period_start ASC`;

      const targets = await db.monthlyTarget.findMany({ orderBy: { month: 'asc' } });
      return NextResponse.json({
        success: true,
        data: {
          period,
          metrics: rows.map((row) => serializeReportRow(row as Record<string, unknown>)),
          targets,
        },
      });
    }

    const rows = await db.$queryRaw<
      {
        month: string;
        revenue: bigint | number | null;
        guests_count: bigint | number | null;
        avg_spend: number | null;
        total_bills: bigint | number | null;
        gofood_revenue: bigint | number | null;
        direct_orders: bigint | number | null;
        tot_collection_amount: bigint | number | null;
      }[]
    >`
        SELECT
          TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS month,
          SUM(nett_sales) AS revenue,
          SUM(total_covers) AS guests_count,
          ROUND(AVG(avg_covers)) AS avg_spend,
          SUM(total_bills) AS total_bills,
          SUM(gofood_amount) AS gofood_revenue,
          SUM(dine_in_amount) AS direct_orders,
          SUM(tot_collection_amount) AS tot_collection_amount
        FROM daily_z_reports
        GROUP BY DATE_TRUNC('month', report_date)
        ORDER BY month ASC`;

    const targets = await db.monthlyTarget.findMany({ orderBy: { month: 'asc' } });
    return NextResponse.json({
      success: true,
      data: {
        period,
        metrics: rows.map((row) => serializeReportRow(row as Record<string, unknown>)),
        targets,
      },
    });
  } catch (err) {
    console.error('[reports]', err);
    return legacyError('Query failed', 500);
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (resource === 'monthly-actuals') {
    return handleMonthlyActuals(request, url);
  }
  if (resource === 'reports') {
    return handleReports(url);
  }

  const db = createClient();
  const service = new FinancialProjectionService(db);

  const chartPeriod = url.searchParams.get('period');
  if (chartPeriod) {
    if (!/^\d{4}-\d{2}$/.test(chartPeriod)) {
      return legacyError('period must be YYYY-MM', 400);
    }
    try {
      const data = await service.getPnlDetail(chartPeriod);
      return NextResponse.json({ success: true, data });
    } catch (err) {
      console.error('[financial-overview/pnl]', err);
      return legacyError('Internal server error', 500);
    }
  }

  try {
    const scenario = (url.searchParams.get('scenario') || 'conservative') as ForecastScenarioKey;
    const data = await service.getChartOverview(
      SCENARIO_MAP[scenario] ? scenario : 'conservative',
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    console.error('[financial-overview]', err);
    return legacyError('Internal server error', 500);
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get('resource') === 'monthly-actuals') {
    return handleMonthlyActuals(request, url);
  }
  return legacyError('GET required', 405);
}
