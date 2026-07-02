/**
 * Per-department monthly actuals with receipt images; consolidates into monthly_actual_inputs.
 */
import { query } from './db.js';
import { num, saveManualInputs, getManualInputs } from './pnl-actuals.js';
import { getActualsDepartment, fieldKeysForDepartment, ACTUALS_COST_DEPARTMENTS } from './monthly-actuals-schema.js';
import { sanitizeReceiptImages, mergeReceiptImages } from './receipt-images.js';

function parseJsonArray(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  try { return JSON.parse(val); } catch { return []; }
}

function parseJsonObject(val) {
  if (!val) return {};
  if (typeof val === 'object' && !Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(val);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function normalizeDeptRow(row) {
  if (!row) return null;
  return {
    period: row.period,
    department: row.department,
    inputs: parseJsonObject(row.inputs),
    receipt_images: parseJsonArray(row.receipt_images),
    notes: row.notes || '',
    updated_at: row.updated_at,
  };
}

export function sanitizeDepartmentInputs(department, raw) {
  const allowed = new Set(fieldKeysForDepartment(department));
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    if (!allowed.has(k)) continue;
    if (v == null || v === '') continue;
    const n = num(v);
    if (n == null) continue;
    out[k] = k.endsWith('_count') ? Math.round(n) : n;
  }
  return out;
}

export async function getDepartmentRecord(period, department) {
  const result = await query(
    `SELECT period, department, inputs, receipt_images, notes, updated_at
     FROM monthly_actual_departments
     WHERE period = $1 AND department = $2
     LIMIT 1`,
    [period, department],
  );
  return normalizeDeptRow(result.rows[0]);
}

export async function getAllDepartmentRecords(period) {
  const result = await query(
    `SELECT period, department, inputs, receipt_images, notes, updated_at
     FROM monthly_actual_departments
     WHERE period = $1
     ORDER BY department`,
    [period],
  );
  return result.rows.map(normalizeDeptRow);
}

export async function consolidateDepartmentInputs(period) {
  const rows = await getAllDepartmentRecords(period);
  const merged = {};
  for (const row of rows) {
    Object.assign(merged, row.inputs || {});
  }
  if (rows.length) {
    await saveManualInputs(period, merged);
  }
  return merged;
}

export async function getDepartmentStatuses(period) {
  const rows = await getAllDepartmentRecords(period);
  const monthInputs = await getManualInputs(period);
  const byId = Object.fromEntries(rows.map((r) => [r.department, r]));
  return ACTUALS_COST_DEPARTMENTS.map((d) => {
    const row = byId[d.id];
    const deptKeys = fieldKeysForDepartment(d.id);
    const monthInputCount = deptKeys.filter((k) => {
      const v = monthInputs[k];
      return v != null && v !== '';
    }).length;
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

function sumInputValues(inputs) {
  let total = 0;
  for (const v of Object.values(inputs || {})) {
    const n = num(v);
    if (n != null) total += n;
  }
  return total;
}

export async function listRecentActualsEntries(limit = 10, offset = 0) {
  const safeLimit = Math.min(50, Math.max(1, limit));
  const safeOffset = Math.max(0, offset);
  const countResult = await query(
    `SELECT COUNT(*)::int AS total FROM (
       SELECT period FROM monthly_actual_inputs WHERE period >= '2026-06'
       UNION ALL
       SELECT period FROM monthly_actual_departments
     ) combined`,
  );
  const result = await query(
    `SELECT period, kind, department, inputs, receipt_images, updated_at FROM (
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
     LIMIT $1 OFFSET $2`,
    [safeLimit, safeOffset],
  );
  const rows = result.rows.map((row) => {
    const dept = getActualsDepartment(row.department);
    const receipts = parseJsonArray(row.receipt_images);
    return {
      period: row.period,
      kind: row.kind,
      department: row.department,
      department_label: row.kind === 'month'
        ? 'All sections'
        : (dept?.shortLabel || row.department),
      input_count: Object.keys(parseJsonObject(row.inputs)).length,
      input_total: sumInputValues(parseJsonObject(row.inputs)),
      receipt_count: receipts.length,
      updated_at: row.updated_at,
    };
  });
  return {
    rows,
    total: countResult.rows[0]?.total || 0,
  };
}

/** Management entry: merge department cost lines into month totals — receipts optional. */
export async function saveDepartmentInputsOnly(period, department, payload) {
  if (!getActualsDepartment(department)) {
    throw new Error('Invalid cost department');
  }

  const cleanInputs = sanitizeDepartmentInputs(department, payload.inputs || {});
  if (!Object.keys(cleanInputs).length) {
    throw new Error('Enter at least one cost amount before saving.');
  }

  const existingMonth = await getManualInputs(period);
  await saveManualInputs(period, { ...existingMonth, ...cleanInputs });

  const deptExisting = await getDepartmentRecord(period, department);
  if (deptExisting) {
    await query(
      `UPDATE monthly_actual_departments
       SET inputs = $3::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE period = $1 AND department = $2`,
      [period, department, JSON.stringify({ ...deptExisting.inputs, ...cleanInputs })],
    );
  }

  return {
    department,
    inputs: cleanInputs,
    inputs_only: true,
    receipt_images: deptExisting?.receipt_images || [],
  };
}

export async function saveDepartmentRecord(period, department, payload) {
  if (!getActualsDepartment(department)) {
    throw new Error('Invalid cost department');
  }

  const existing = await getDepartmentRecord(period, department);
  const incomingImages = sanitizeReceiptImages(payload.receipt_images || []);
  let mergedImages;
  try {
    mergedImages = mergeReceiptImages(existing?.receipt_images || [], incomingImages);
  } catch (err) {
    throw new Error(err.message);
  }

  if (!mergedImages.length) {
    throw new Error(
      'At least one expense receipt photo is required. Attach invoice or payment proof before saving.',
    );
  }

  const cleanInputs = sanitizeDepartmentInputs(department, payload.inputs || {});
  const notes = payload.notes != null ? String(payload.notes).trim().slice(0, 10000) : (existing?.notes || '');

  await query(
    `INSERT INTO monthly_actual_departments
       (period, department, inputs, receipt_images, notes, updated_at)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5, CURRENT_TIMESTAMP)
     ON CONFLICT (period, department)
     DO UPDATE SET
       inputs = EXCLUDED.inputs,
       receipt_images = EXCLUDED.receipt_images,
       notes = EXCLUDED.notes,
       updated_at = CURRENT_TIMESTAMP`,
    [period, department, JSON.stringify(cleanInputs), JSON.stringify(mergedImages), notes],
  );

  const consolidated = await consolidateDepartmentInputs(period);
  return {
    department,
    inputs: cleanInputs,
    receipt_images: mergedImages,
    notes,
    consolidated,
  };
}
