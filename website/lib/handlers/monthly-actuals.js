/**
 * Monthly cost inputs — GET/POST handler (mounted on financial-overview?resource=monthly-actuals).
 *
 * GET  ?period=YYYY-MM[&department=direct][&prefill=1]
 * POST { period, department?, inputs, receipt_images?, notes? }
 */
import {
  MANUAL_INPUT_SECTIONS,
  COMPUTED_PREVIEW_KEYS,
  isExcelLedgerMonth,
  sanitizeManualInputs,
  getManualInputs,
  saveManualInputs,
  buildComputedPnl,
  computedPreview,
  getYtdTotalsBefore,
} from '../pnl-actuals.js';
import { buildPrefillInputs } from '../monthly-actuals-prefill.js';
import {
  ACTUALS_COST_DEPARTMENTS,
  getActualsDepartment,
  sectionForDepartment,
} from '../monthly-actuals-schema.js';
import {
  getDepartmentRecord,
  getDepartmentStatuses,
  saveDepartmentRecord,
  saveDepartmentInputsOnly,
  sanitizeDepartmentInputs,
  listRecentActualsEntries,
} from '../monthly-actuals-store.js';
import {
  aggregateZReportsForMonth,
  resyncActualsCascadeFrom,
} from '../sync-monthly-actuals.js';

const ADMIN_KEY = process.env.METRICS_WRITE_API_KEY || 'rosalita2026';

function requireAdmin(req, res) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function parsePeriod(req) {
  const period = req.query?.period || req.body?.period;
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return null;
  return period;
}

function inputsForDepartment(consolidated, department) {
  const keys = new Set(getActualsDepartment(department)?.fields.map((f) => f.key) || []);
  const out = {};
  for (const [k, v] of Object.entries(consolidated || {})) {
    if (keys.has(k)) out[k] = v;
  }
  return out;
}

async function buildPayload(period, departmentId) {
  const excelLocked = isExcelLedgerMonth(period);
  const manualInputs = excelLocked ? {} : await getManualInputs(period);
  const zAgg = await aggregateZReportsForMonth(period);
  const ytdBefore = excelLocked ? null : await getYtdTotalsBefore(period);
  const values = buildComputedPnl(period, zAgg, manualInputs, ytdBefore);
  const department_statuses = excelLocked ? [] : await getDepartmentStatuses(period);

  const activeDept = departmentId && getActualsDepartment(departmentId)
    ? departmentId
    : 'direct';

  let deptPayload = null;
  if (!excelLocked && getActualsDepartment(activeDept)) {
    const record = await getDepartmentRecord(period, activeDept);
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

export async function handleMonthlyActuals(req, res) {
  if (!requireAdmin(req, res)) return;

  try {
    if (req.method === 'GET') {
      if (req.query.recent === '1' || req.query.recent === 'true') {
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 10));
        const page = Math.max(1, parseInt(req.query.page, 10) || 1);
        const offset = (page - 1) * limit;
        const { rows, total } = await listRecentActualsEntries(limit, offset);
        return res.status(200).json({
          rows,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        });
      }

      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: 'period=YYYY-MM required' });

      if (isExcelLedgerMonth(period) && req.query.prefill === '1') {
        return res.status(400).json({
          error: 'Jan–May 2026 actuals are sourced from Excel and cannot be prefilled here.',
        });
      }

      const departmentId = String(req.query.department || '').trim() || null;
      const payload = await buildPayload(period, departmentId);

      if (req.query.prefill === '1' || req.query.prefill === 'true') {
        const fromPeriod = String(req.query.prefill_from || '').trim();
        const prefillOpts = /^\d{4}-\d{2}$/.test(fromPeriod) ? { fromPeriod } : {};
        const prefill = await buildPrefillInputs(period, payload.z_aggregate, prefillOpts);
        const scope = req.query.scope === 'month' ? 'month' : 'dept';
        const ytdBefore = await getYtdTotalsBefore(period);

        if (scope === 'month') {
          const hasSaved = payload.inputs && Object.keys(payload.inputs).length > 0;
          const useInputs = hasSaved && req.query.prefill_mode !== 'replace'
            ? { ...prefill.inputs, ...payload.inputs }
            : prefill.inputs;
          const values = buildComputedPnl(period, payload.z_aggregate, useInputs, ytdBefore);

          return res.status(200).json({
            ...payload,
            inputs: useInputs,
            prefill: prefill.prefill_meta,
            computed_preview: computedPreview(values),
            prefilled: true,
            prefill_scope: 'month',
          });
        }

        const dept = departmentId || 'direct';
        const deptKeys = new Set(getActualsDepartment(dept)?.fields.map((f) => f.key) || []);
        const fullPrefill = prefill.inputs;
        const deptPrefill = {};
        for (const [k, v] of Object.entries(fullPrefill)) {
          if (deptKeys.has(k)) deptPrefill[k] = v;
        }

        const existingDept = payload.department_detail?.inputs || {};
        const hasSaved = existingDept && Object.keys(existingDept).length > 0;
        const useDeptInputs = hasSaved && req.query.prefill_mode !== 'replace'
          ? { ...deptPrefill, ...existingDept }
          : deptPrefill;

        const mergedMonth = { ...payload.inputs, ...useDeptInputs };
        const values = buildComputedPnl(period, payload.z_aggregate, mergedMonth, ytdBefore);

        return res.status(200).json({
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
        });
      }

      return res.status(200).json(payload);
    }

    if (req.method === 'POST') {
      const period = parsePeriod(req);
      if (!period) return res.status(400).json({ error: 'period (YYYY-MM) required' });

      if (isExcelLedgerMonth(period)) {
        return res.status(400).json({
          error: 'Jan–May 2026 actuals are sourced from Excel and cannot be edited here.',
        });
      }

      const department = String(req.body?.department || '').trim();

      if (department) {
        const inputsOnly = req.body?.inputs_only === true
          || req.body?.save_mode === 'costs';
        const saved = inputsOnly
          ? await saveDepartmentInputsOnly(period, department, {
            inputs: req.body?.inputs || {},
          })
          : await saveDepartmentRecord(period, department, {
            inputs: req.body?.inputs || {},
            receipt_images: req.body?.receipt_images || [],
            notes: req.body?.notes,
          });
        await resyncActualsCascadeFrom(period);

        const payload = await buildPayload(period, department);
        return res.status(200).json({
          ...payload,
          synced: true,
          saved_department: department,
          department_saved: saved,
        });
      }

      const inputs = sanitizeManualInputs(req.body?.inputs || {});
      await saveManualInputs(period, inputs);
      await resyncActualsCascadeFrom(period);

      const payload = await buildPayload(period, null);
      return res.status(200).json({ ...payload, synced: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('[monthly-actuals]', err);
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
