import type { DbClient } from '@/lib/db';
import {
  buildComputedPnl,
  computedPreview,
  num,
  sanitizeManualInputs,
} from '@/domain/financial/pnl-calculator';
import { SyncMonthlyActuals } from '@/domain/actuals/sync-monthly-actuals';
import { MonthlyActualsPrefill } from '@/domain/actuals/monthly-actuals-prefill';
import {
  ACTUALS_COST_DEPARTMENTS,
  fieldKeysForDepartment,
  getActualsDepartment,
} from '@/domain/actuals/monthly-actuals-schema';
import {
  mergeReceiptImages,
  sanitizeReceiptImages,
  type ReceiptImage,
} from '@/domain/z-report/receipt-images';

export interface DepartmentRecord {
  period: string;
  department: string;
  inputs: Record<string, number>;
  receipt_images: ReceiptImage[];
  notes: string;
  updated_at: Date | null;
}

function parseJsonArray(val: unknown): ReceiptImage[] {
  if (!val) return [];
  if (Array.isArray(val)) return val as ReceiptImage[];
  try {
    return JSON.parse(String(val)) as ReceiptImage[];
  } catch {
    return [];
  }
}

function parseJsonObject(val: unknown): Record<string, number> {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val as Record<string, number>;
  try {
    const parsed = JSON.parse(String(val)) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    return {};
  }
}

function normalizeDeptRow(row: {
  period: string;
  department: string;
  inputs: unknown;
  receiptImages: unknown;
  notes: string;
  updatedAt: Date;
} | null): DepartmentRecord | null {
  if (!row) return null;
  return {
    period: row.period,
    department: row.department,
    inputs: parseJsonObject(row.inputs),
    receipt_images: parseJsonArray(row.receiptImages),
    notes: row.notes || '',
    updated_at: row.updatedAt,
  };
}

export class MonthlyActualsService {
  private readonly sync: SyncMonthlyActuals;
  private readonly prefill: MonthlyActualsPrefill;

  constructor(private readonly db: DbClient) {
    this.sync = new SyncMonthlyActuals(db);
    this.prefill = new MonthlyActualsPrefill(db);
  }

  sanitizeDepartmentInputs(department: string, raw: Record<string, unknown>): Record<string, number> {
    const allowed = new Set(fieldKeysForDepartment(department));
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(raw ?? {})) {
      if (!allowed.has(k)) continue;
      if (v == null || v === '') continue;
      const n = num(v);
      if (n == null) continue;
      out[k] = k.endsWith('_count') ? Math.round(n) : n;
    }
    return out;
  }

  async getDepartmentRecord(period: string, department: string): Promise<DepartmentRecord | null> {
    const row = await this.db.monthlyActualDepartment.findUnique({
      where: { period_department: { period, department } },
    });
    return normalizeDeptRow(row);
  }

  async getAllDepartmentRecords(period: string): Promise<DepartmentRecord[]> {
    const rows = await this.db.monthlyActualDepartment.findMany({
      where: { period },
      orderBy: { department: 'asc' },
    });
    return rows.map((r) => normalizeDeptRow(r)!).filter(Boolean);
  }

  async getManualInputs(period: string): Promise<Record<string, number>> {
    return this.sync.getManualInputs(period);
  }

  async saveManualInputs(period: string, inputs: Record<string, unknown>): Promise<Record<string, number>> {
    const clean = sanitizeManualInputs(inputs);
    await this.db.monthlyActualInput.upsert({
      where: { period },
      create: { period, inputs: clean },
      update: { inputs: clean },
    });
    await this.sync.resyncActualsCascadeFrom(period);
    return clean;
  }

  async consolidateDepartmentInputs(period: string): Promise<Record<string, number>> {
    const rows = await this.getAllDepartmentRecords(period);
    const merged: Record<string, number> = {};
    for (const row of rows) {
      Object.assign(merged, row.inputs || {});
    }
    if (rows.length) {
      await this.saveManualInputs(period, merged);
    }
    return merged;
  }

  async getDepartmentStatuses(period: string) {
    const rows = await this.getAllDepartmentRecords(period);
    const monthInputs = await this.getManualInputs(period);
    const byId = Object.fromEntries(rows.map((r) => [r.department, r]));
    return ACTUALS_COST_DEPARTMENTS.map((d) => {
      const row = byId[d.id];
      const deptKeys = fieldKeysForDepartment(d.id);
      const monthInputCount = deptKeys.filter((k) => monthInputs[k] != null).length;
      const rowInputCount = row?.inputs ? Object.keys(row.inputs).length : 0;
      const inputCount = Math.max(rowInputCount, monthInputCount);
      return {
        id: d.id,
        label: d.shortLabel,
        saved: !!row,
        has_costs: inputCount > 0,
        receipt_count: row?.receipt_images?.length || 0,
        input_count: inputCount,
        updated_at: row?.updated_at || null,
      };
    });
  }

  async listRecentActualsEntries(limit = 10, offset = 0) {
    const safeLimit = Math.min(50, Math.max(1, limit));
    const safeOffset = Math.max(0, offset);

    const countResult = await this.db.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total FROM (
        SELECT period FROM monthly_actual_inputs WHERE period >= '2026-06'
        UNION ALL
        SELECT period FROM monthly_actual_departments
      ) combined`;

    const rows = await this.db.$queryRaw<{
      period: string;
      kind: string;
      department: string;
      inputs: unknown;
      receipt_images: unknown;
      updated_at: Date | null;
    }[]>`
      SELECT period, kind, department, inputs, receipt_images, updated_at FROM (
        SELECT period, 'month' AS kind, 'all' AS department, inputs,
               '[]'::jsonb AS receipt_images, updated_at
        FROM monthly_actual_inputs
        WHERE period >= '2026-06'
        UNION ALL
        SELECT period, 'department' AS kind, department, inputs,
               receipt_images, updated_at
        FROM monthly_actual_departments
      ) combined
      ORDER BY updated_at DESC NULLS LAST, period DESC, department ASC
      LIMIT ${safeLimit} OFFSET ${safeOffset}`;

    const mapped = rows.map((row) => {
      const dept = getActualsDepartment(row.department);
      const receipts = parseJsonArray(row.receipt_images);
      const inputs = parseJsonObject(row.inputs);
      let inputTotal = 0;
      for (const v of Object.values(inputs)) {
        const n = num(v);
        if (n != null) inputTotal += n;
      }
      return {
        period: row.period,
        kind: row.kind,
        department: row.department,
        department_label: row.kind === 'month' ? 'All sections' : (dept?.shortLabel || row.department),
        input_count: Object.keys(inputs).length,
        input_total: inputTotal,
        receipt_count: receipts.length,
        updated_at: row.updated_at,
      };
    });

    return { rows: mapped, total: countResult[0]?.total || 0 };
  }

  async saveDepartmentInputsOnly(
    period: string,
    department: string,
    payload: { inputs?: Record<string, unknown> },
  ) {
    if (!getActualsDepartment(department)) {
      throw new Error('Invalid cost department');
    }

    const cleanInputs = this.sanitizeDepartmentInputs(department, payload.inputs || {});
    if (!Object.keys(cleanInputs).length) {
      throw new Error('Enter at least one cost amount before saving.');
    }

    const existingMonth = await this.getManualInputs(period);
    await this.saveManualInputs(period, { ...existingMonth, ...cleanInputs });

    const deptExisting = await this.getDepartmentRecord(period, department);
    if (deptExisting) {
      await this.db.monthlyActualDepartment.update({
        where: { period_department: { period, department } },
        data: { inputs: { ...deptExisting.inputs, ...cleanInputs } },
      });
    }

    return {
      department,
      inputs: cleanInputs,
      inputs_only: true,
      receipt_images: deptExisting?.receipt_images || [],
    };
  }

  async saveDepartmentRecord(
    period: string,
    department: string,
    payload: { inputs?: Record<string, unknown>; receipt_images?: unknown; notes?: string },
  ) {
    if (!getActualsDepartment(department)) {
      throw new Error('Invalid cost department');
    }

    const existing = await this.getDepartmentRecord(period, department);
    const incomingImages = sanitizeReceiptImages(payload.receipt_images || []);
    const mergedImages = mergeReceiptImages(existing?.receipt_images || [], incomingImages);

    if (!mergedImages.length) {
      throw new Error(
        'At least one expense receipt photo is required. Attach invoice or payment proof before saving.',
      );
    }

    const cleanInputs = this.sanitizeDepartmentInputs(department, payload.inputs || {});
    const notes = payload.notes != null
      ? String(payload.notes).trim().slice(0, 10000)
      : (existing?.notes || '');

    await this.db.monthlyActualDepartment.upsert({
      where: { period_department: { period, department } },
      create: {
        period,
        department,
        inputs: cleanInputs,
        receiptImages: mergedImages as unknown as object,
        notes,
      },
      update: {
        inputs: cleanInputs,
        receiptImages: mergedImages as unknown as object,
        notes,
      },
    });

    const consolidated = await this.consolidateDepartmentInputs(period);
    await this.sync.resyncActualsCascadeFrom(period);

    return {
      department,
      inputs: cleanInputs,
      receipt_images: mergedImages,
      notes,
      consolidated,
    };
  }

  async buildPrefill(period: string) {
    const zAgg = await this.sync.aggregateZReportsForMonth(period);
    return this.prefill.buildPrefillInputs(period, zAgg);
  }

  async getComputedPreview(period: string) {
    const zAgg = await this.sync.aggregateZReportsForMonth(period);
    const manualInputs = await this.getManualInputs(period);
    const ytdBefore = await this.sync.getYtdTotalsBefore(period);
    const values = buildComputedPnl(period, zAgg, manualInputs, ytdBefore);
    return computedPreview(values);
  }
}
