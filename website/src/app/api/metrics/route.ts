/**
 * Z-report metrics API — legacy reference: website/api/metrics.js
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { ZReportService } from '@/domain/z-report/z-report-service';
import {
  getDepartment,
  legacyAliases,
  requiredForDepartment,
  sectionsForDepartment,
  Z_REPORT_DEPARTMENTS,
  Z_REPORT_RECEIPT_SECTIONS,
  Z_REPORT_SECTIONS,
} from '@/domain/z-report/z-report-schema';
import { sanitizeReceiptImages } from '@/domain/z-report/receipt-images';
import { toIsoDate, toPeriodApiValue, toTimeApiValue } from '@/domain/shared/date-utils';
import { legacyError } from '@/lib/api/response';
import type { DailyZReport } from '@/generated/prisma';

const importBodySchema = z.object({
  action: z.literal('import'),
  mode: z.enum(['daily', 'monthly_prorate']).optional(),
  rows: z.array(z.record(z.unknown())).optional(),
  period: z.string().optional(),
  monthly: z.record(z.unknown()).optional(),
  fill_missing_only: z.boolean().optional(),
  overwrite_imported: z.boolean().optional(),
});

function normalizeRow(row: DailyZReport | Record<string, unknown>): Record<string, unknown> {
  const r = { ...row } as Record<string, unknown>;
  const dateSrc = r.report_date ?? r.reportDate ?? r.date;
  if (dateSrc) {
    const ds = toIsoDate(dateSrc) || String(dateSrc).slice(0, 10);
    r.report_date = ds;
    r.date = ds;
  }
  if (r.report_time ?? r.reportTime) {
    r.report_time = toTimeApiValue(r.report_time ?? r.reportTime);
  }
  for (const [camel, snake] of [
    ['periodStart', 'period_start'],
    ['periodEnd', 'period_end'],
    ['createdAt', 'created_at'],
    ['correctedAt', 'corrected_at'],
    ['entrySource', 'entry_source'],
    ['receiptImages', 'receipt_images'],
    ['nettSales', 'nett_sales'],
    ['totalSales', 'total_sales'],
    ['totalCovers', 'total_covers'],
    ['avgBills', 'avg_bills'],
    ['avgCovers', 'avg_covers'],
    ['totalBills', 'total_bills'],
  ] as const) {
    if (r[camel] !== undefined && r[snake] === undefined) r[snake] = r[camel];
  }
  if (r.period_start) {
    r.period_start = toPeriodApiValue(r.period_start) || String(r.period_start).replace('T', ' ').slice(0, 19);
  }
  if (r.period_end) {
    r.period_end = toPeriodApiValue(r.period_end) || String(r.period_end).replace('T', ' ').slice(0, 19);
  }
  if (!r.entry_source) r.entry_source = 'manual';
  if (!r.department) r.department = 'all_pos';
  if (r.receipt_images && typeof r.receipt_images === 'string') {
    try { r.receipt_images = JSON.parse(r.receipt_images); } catch { r.receipt_images = []; }
  }
  if (!Array.isArray(r.receipt_images)) r.receipt_images = [];
  return r;
}

function rowToApi(row: DailyZReport): Record<string, unknown> {
  const normalized = normalizeRow(row);
  const stripped = new ZReportService(createClient()).stripReceiptImages(normalized);
  return legacyAliases(stripped ?? normalized) as Record<string, unknown>;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const db = createClient();
  const service = new ZReportService(db);

  if (url.searchParams.get('schema') === '1') {
    const dept = String(url.searchParams.get('department') || '').trim();
    const department = dept && getDepartment(dept) ? dept : 'all_pos';
    return NextResponse.json({
      success: true,
      data: {
        sections: Z_REPORT_SECTIONS,
        receipt_sections: Z_REPORT_RECEIPT_SECTIONS,
        required: requiredForDepartment(department),
        form_sections: sectionsForDepartment(department, true),
        departments: Z_REPORT_DEPARTMENTS.map((d) => ({
          id: d.id,
          label: d.label,
          shortLabel: d.shortLabel,
          description: d.description,
          required: d.required,
        })),
        department,
      },
    });
  }

  if (url.searchParams.has('calendar')) {
    const guard = await requireWriteAuth(request);
    if (!guard.ok) return guard.response;
    const period = String(url.searchParams.get('calendar')).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return legacyError('calendar must be YYYY-MM', 400);
    }
    try {
      const calendar = await service.getMonthCalendar(period);
      return NextResponse.json({ success: true, data: calendar });
    } catch (err) {
      console.error('GET calendar error:', err);
      return legacyError('Calendar query failed', 500);
    }
  }

  if (url.searchParams.has('detail')) {
    const guard = await requireWriteAuth(request);
    if (!guard.ok) return guard.response;
    let date = toIsoDate(url.searchParams.get('detail'));
    if (!date && /^\d{4}-\d{2}-\d{2}/.test(String(url.searchParams.get('detail')))) {
      date = String(url.searchParams.get('detail')).slice(0, 10);
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return legacyError('detail must be YYYY-MM-DD', 400);
    }
    try {
      const department = String(url.searchParams.get('department') || 'all_pos').trim() || 'all_pos';
      const row = await service.getByDate(date, department);
      if (!row) return legacyError('Entry not found', 404);
      const normalized = normalizeRow(row);
      return NextResponse.json({
        success: true,
        data: legacyAliases(normalized),
        row: normalized,
      });
    } catch (err) {
      console.error('GET detail error:', err);
      return legacyError('Detail query failed', 500);
    }
  }

  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const exportAll = url.searchParams.get('export') === '1';
  const limit = Math.min(
    exportAll ? 5000 : 100,
    Math.max(1, parseInt(url.searchParams.get('limit') ?? '10', 10) || 10),
  );
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const offset = (page - 1) * limit;

  const where: {
    reportDate?: { gte?: Date; lte?: Date };
    entrySource?: { in: string[] } | { notIn: string[] };
  } = {};

  if (from) where.reportDate = { ...where.reportDate, gte: new Date(`${from}T00:00:00.000Z`) };
  if (to) where.reportDate = { ...where.reportDate, lte: new Date(`${to}T00:00:00.000Z`) };

  const sourceFilter = String(url.searchParams.get('source') || '').trim().toLowerCase();
  if (sourceFilter === 'pos' || sourceFilter === 'manual') {
    where.entrySource = { notIn: ['xlsx_daily', 'xlsx_prorate'] };
  } else if (sourceFilter === 'xlsx' || sourceFilter === 'import') {
    where.entrySource = { in: ['xlsx_daily', 'xlsx_prorate'] };
  }

  try {
    const [rows, total] = await Promise.all([
      db.dailyZReport.findMany({
        where,
        orderBy: [{ reportDate: 'desc' }, { department: 'asc' }],
        ...(exportAll ? { take: limit } : { take: limit, skip: offset }),
      }),
      exportAll
        ? Promise.resolve(0)
        : db.dailyZReport.count({ where }),
    ]);

    const normalized = rows.map((r) => {
      const n = normalizeRow(r);
      return service.stripReceiptImages(n) ?? n;
    });
    const data = normalized.map((r) => legacyAliases({ ...r }));

    return NextResponse.json({
      success: true,
      data,
      rows: normalized,
      pagination: exportAll
        ? null
        : {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
    });
  } catch (err) {
    console.error('GET /api/metrics error:', err);
    return legacyError('Database query failed', 500);
  }
}

export async function POST(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return legacyError('Invalid JSON body', 400);
  }

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const service = new ZReportService(db);

  const importParsed = importBodySchema.safeParse(body);
  if (importParsed.success) {
    const { mode = 'daily', rows, period, monthly, fill_missing_only, overwrite_imported } = importParsed.data;
    const options = {
      fillMissingOnly: fill_missing_only !== false,
      overwriteImported: overwrite_imported !== false,
    };

    try {
      if (mode === 'monthly_prorate') {
        const p = String(period || '').slice(0, 7);
        if (!/^\d{4}-\d{2}$/.test(p)) {
          return legacyError('period must be YYYY-MM for monthly_prorate', 400);
        }
        const result = await service.importMonthlyProrate(p, monthly ?? {}, options);
        return NextResponse.json({ success: true, ok: true, mode, ...result });
      }

      if (!rows?.length) {
        return legacyError('rows array is required for daily import', 400);
      }
      const result = await service.importDailyRows(rows, options);
      return NextResponse.json({ success: true, ok: true, mode: 'daily', ...result });
    } catch (err) {
      console.error('POST import error:', err);
      return legacyError(err instanceof Error ? err.message : 'Import failed', 500);
    }
  }

  const rowBody = body as Record<string, unknown>;
  const department = String(rowBody.department || 'all_pos').trim() || 'all_pos';
  if (!getDepartment(department)) {
    return legacyError('Invalid department', 400);
  }

  if (rowBody.is_correction === true) {
    const correctionField = String(rowBody.correction_field || '').trim();
    const correctionReason = String(rowBody.correction_reason || '').trim();
    if (!correctionField || !correctionReason) {
      return legacyError('Correction field and reason are required when re-uploading a corrected entry.', 400);
    }
  }

  const reportDate = toIsoDate(rowBody.report_date ?? rowBody.date);
  if (!reportDate) {
    return legacyError('Report date is required', 400);
  }

  const deptRequired = requiredForDepartment(department);
  for (const key of deptRequired) {
    if (key === 'report_date') continue;
    const val = rowBody[key];
    if (val == null || val === '') {
      const label = getDepartment(department).shortLabel || department;
      return legacyError(`Missing required field for ${label}: ${key}`, 400);
    }
  }

  if (department === 'all_pos') {
    if (!rowBody.nett_sales && !rowBody.total_sales) {
      return legacyError('Nett Sales or Total Sales is required', 400);
    }
    if (!rowBody.total_covers) {
      return legacyError('Total # of Covers is required', 400);
    }
  }

  try {
    sanitizeReceiptImages(rowBody.receipt_images);
  } catch (imgErr) {
    return legacyError(imgErr instanceof Error ? imgErr.message : 'Invalid receipt images', 400);
  }

  const existing = await service.getByDate(reportDate, department);
  const existingImages = existing?.receiptImages;
  const incoming = sanitizeReceiptImages(rowBody.receipt_images);
  const merged = [...(Array.isArray(existingImages) ? existingImages : []), ...incoming];

  try {
    const saved = await service.upsert({
      ...rowBody,
      report_date: reportDate,
      department,
      receipt_images: merged,
      ...(rowBody.is_correction === true
        ? {
            corrected_at: new Date().toISOString(),
            correction_field: rowBody.correction_field,
            correction_reason: rowBody.correction_reason,
          }
        : {}),
    });

    return NextResponse.json(
      { success: true, data: rowToApi(saved) },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST /api/metrics error:', err);
    if (err instanceof Error && 'code' in err) {
      console.error('POST /api/metrics detail:', JSON.stringify({
        message: err.message,
        code: (err as Record<string, unknown>).code,
        meta: (err as Record<string, unknown>).meta,
      }, null, 2));
    }
    return NextResponse.json(
      { success: false, error: 'Insert failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const period = url.searchParams.get('period') ? String(url.searchParams.get('period')).slice(0, 7) : null;
  const reportDate = url.searchParams.get('report_date') || url.searchParams.get('date');
  const importedOnly = url.searchParams.get('scope') === 'imported' || url.searchParams.get('imported_only') === '1';

  const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  const service = new ZReportService(db);

  try {
    if (period && !reportDate) {
      const result = await service.deleteMonthImported(period);
      return NextResponse.json({ success: true, ok: true, ...result });
    }

    if (!reportDate) {
      return legacyError('report_date or period is required', 400);
    }

    const result = await service.deleteZReport(reportDate, { importedOnly });
    if (!result.deleted) {
      return NextResponse.json(result, {
        status: result.reason === 'not_found' ? 404 : 409,
      });
    }
    return NextResponse.json({ success: true, ok: true, ...result });
  } catch (err) {
    console.error('DELETE /api/metrics error:', err);
    return NextResponse.json(
      { success: false, error: 'Delete failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
