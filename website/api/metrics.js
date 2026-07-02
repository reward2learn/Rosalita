import { query } from '../lib/db.js';
import {
  Z_REPORT_FIELD_KEYS,
  Z_REPORT_SECTIONS,
  Z_REPORT_RECEIPT_SECTIONS,
  Z_REPORT_DEPARTMENTS,
  getDepartment,
  requiredForDepartment,
  sectionsForDepartment,
  legacyAliases,
} from '../lib/z-report-schema.js';
import { resyncActualsCascadeFrom } from '../lib/sync-monthly-actuals.js';
import {
  importDailyRows,
  importMonthlyProrate,
  deleteZReport,
  deleteMonthImported,
  getMonthCalendar,
} from '../lib/z-report-import.js';
import { sanitizeReceiptImages, stripReceiptImages, mergeReceiptImages } from '../lib/receipt-images.js';
import { toIsoDate, toSqlTimestamp, toPeriodApiValue } from '../lib/date-utils.js';

const ADMIN_KEY = process.env.METRICS_WRITE_API_KEY || 'rosalita2026';

const AMOUNT_KEYS = new Set(
  Z_REPORT_FIELD_KEYS.filter((k) =>
    k.endsWith('_amount') || k === 'total_sales' || k === 'estimated_sales'
    || k === 'nett_sales' || k === 'avg_bills' || k === 'avg_covers',
  ),
);

function checkAdmin(req, res) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function coerceValue(key, val) {
  if (val === null || val === undefined || val === '') return null;
  if (key === 'report_date') return toIsoDate(val) || String(val).slice(0, 10);
  if (key === 'report_time') return String(val).slice(0, 8);
  if (key === 'period_start' || key === 'period_end') {
    const ts = toSqlTimestamp(val);
    return ts || null;
  }
  if (key === 'operator' || key === 'pos_group' || key === 'begin_receipt_no' || key === 'end_receipt_no') {
    return String(val).trim();
  }
  if (AMOUNT_KEYS.has(key)) {
    const n = Number(String(val).replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  const n = parseInt(String(val).replace(/,/g, ''), 10);
  return Number.isFinite(n) ? n : null;
}

function buildRow(body) {
  const row = {};
  for (const key of Z_REPORT_FIELD_KEYS) {
    if (body[key] !== undefined) row[key] = coerceValue(key, body[key]);
  }
  if (body.raw_text) row.raw_text = String(body.raw_text).trim();
  row.entry_source = 'manual';
  row.department = String(body.department || 'all_pos').trim() || 'all_pos';
  if (body.is_correction === true) {
    row.corrected_at = new Date().toISOString();
    if (body.correction_field) row.correction_field = String(body.correction_field).trim();
    if (body.correction_reason) row.correction_reason = String(body.correction_reason).trim();
  }
  return row;
}

function normalizeRow(row) {
  if (!row) return row;
  const r = { ...row };
  const dateSrc = r.report_date || r.date;
  if (dateSrc) {
    const ds = toIsoDate(dateSrc) || String(dateSrc).slice(0, 10);
    r.report_date = ds;
    r.date = ds;
  }
  if (r.report_time) r.report_time = String(r.report_time).slice(0, 8);
  if (r.period_start) r.period_start = toPeriodApiValue(r.period_start) || String(r.period_start).replace('T', ' ').slice(0, 19);
  if (r.period_end) r.period_end = toPeriodApiValue(r.period_end) || String(r.period_end).replace('T', ' ').slice(0, 19);
  if (r.created_at) r.created_at = String(r.created_at).replace('T', ' ').slice(0, 19);
  if (r.corrected_at) r.corrected_at = String(r.corrected_at).replace('T', ' ').slice(0, 19);
  if (!r.entry_source) r.entry_source = 'manual';
  if (!r.department) r.department = 'all_pos';
  if (r.receipt_images && typeof r.receipt_images === 'string') {
    try { r.receipt_images = JSON.parse(r.receipt_images); } catch { r.receipt_images = []; }
  }
  if (!Array.isArray(r.receipt_images)) r.receipt_images = [];
  return r;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    if (req.query.schema === '1') {
      const dept = String(req.query.department || '').trim();
      const department = dept && getDepartment(dept) ? dept : null;
      return res.status(200).json({
        sections: Z_REPORT_SECTIONS,
        receipt_sections: Z_REPORT_RECEIPT_SECTIONS,
        required: requiredForDepartment(department || 'all_pos'),
        form_sections: sectionsForDepartment(department || 'all_pos', true),
        departments: Z_REPORT_DEPARTMENTS.map((d) => ({
          id: d.id,
          label: d.label,
          shortLabel: d.shortLabel,
          description: d.description,
          required: d.required,
        })),
        department: department || 'all_pos',
      });
    }

    if (req.query.calendar) {
      if (!checkAdmin(req, res)) return;
      const period = String(req.query.calendar).slice(0, 7);
      if (!/^\d{4}-\d{2}$/.test(period)) {
        return res.status(400).json({ error: 'calendar must be YYYY-MM' });
      }
      try {
        const calendar = await getMonthCalendar(period);
        return res.status(200).json(calendar);
      } catch (err) {
        console.error('GET calendar error:', err);
        return res.status(500).json({ error: 'Calendar query failed' });
      }
    }

    if (req.query.detail) {
      if (!checkAdmin(req, res)) return;
      let date = toIsoDate(req.query.detail);
      if (!date && /^\d{4}-\d{2}-\d{2}/.test(String(req.query.detail))) {
        date = String(req.query.detail).slice(0, 10);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return res.status(400).json({ error: 'detail must be YYYY-MM-DD' });
      }
      try {
        const department = String(req.query.department || 'all_pos').trim() || 'all_pos';
        const result = await query(
          'SELECT * FROM daily_z_reports WHERE report_date = $1 AND department = $2',
          [date, department],
        );
        if (!result.rows[0]) {
          return res.status(404).json({ error: 'Entry not found' });
        }
        const row = normalizeRow(result.rows[0]);
        return res.status(200).json({ data: legacyAliases(row), row });
      } catch (err) {
        console.error('GET detail error:', err);
        return res.status(500).json({ error: 'Detail query failed' });
      }
    }

    const { from, to, page: pageQ, export: exportAll } = req.query;
    const limit = Math.min(
      exportAll === '1' ? 5000 : 100,
      Math.max(1, parseInt(req.query.limit, 10) || 10),
    );
    const page = Math.max(1, parseInt(pageQ, 10) || 1);
    const offset = (page - 1) * limit;

    let sql = 'SELECT * FROM daily_z_reports';
    let countSql = 'SELECT COUNT(*)::int AS total FROM daily_z_reports';
    const params = [];
    const conditions = [];

    if (from) {
      params.push(from);
      conditions.push(`report_date >= $${params.length}`);
    }
    if (to) {
      params.push(to);
      conditions.push(`report_date <= $${params.length}`);
    }
    const sourceFilter = String(req.query.source || '').trim().toLowerCase();
    if (sourceFilter === 'pos' || sourceFilter === 'manual') {
      conditions.push(`COALESCE(entry_source, 'manual') NOT IN ('xlsx_daily', 'xlsx_prorate')`);
    } else if (sourceFilter === 'xlsx' || sourceFilter === 'import') {
      conditions.push(`entry_source IN ('xlsx_daily', 'xlsx_prorate')`);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '';
    sql += where + ' ORDER BY report_date DESC, department ASC';
    countSql += where;

    if (exportAll !== '1') {
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
      params.push(offset);
      sql += ` OFFSET $${params.length}`;
    } else if (limit) {
      params.push(limit);
      sql += ` LIMIT $${params.length}`;
    }

    try {
      const countParams = conditions.length ? params.slice(0, conditions.length) : [];
      const [result, countResult] = await Promise.all([
        query(sql, params),
        exportAll === '1' ? Promise.resolve({ rows: [{ total: 0 }] }) : query(countSql, countParams),
      ]);

      const total = exportAll === '1' ? result.rows.length : (countResult.rows[0]?.total || 0);
      const rows = result.rows.map((r) => stripReceiptImages(normalizeRow(r)));
      const data = rows.map((r) => legacyAliases({ ...r }));

      return res.status(200).json({
        data,
        rows,
        pagination: exportAll === '1' ? null : {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      });
    } catch (err) {
      console.error('GET /api/metrics error:', err);
      return res.status(500).json({ error: 'Database query failed' });
    }
  }

  if (req.method === 'POST') {
    if (!checkAdmin(req, res)) return;

    const body = req.body || {};

    if (body.action === 'import') {
      const mode = body.mode || 'daily';
      const options = {
        fillMissingOnly: body.fill_missing_only !== false,
        overwriteImported: body.overwrite_imported !== false,
      };

      try {
        if (mode === 'monthly_prorate') {
          const period = String(body.period || '').slice(0, 7);
          if (!/^\d{4}-\d{2}$/.test(period)) {
            return res.status(400).json({ error: 'period must be YYYY-MM for monthly_prorate' });
          }
          const result = await importMonthlyProrate(period, body.monthly || {}, options);
          return res.status(200).json({ ok: true, mode, ...result });
        }

        const rows = Array.isArray(body.rows) ? body.rows : [];
        if (!rows.length) {
          return res.status(400).json({ error: 'rows array is required for daily import' });
        }
        const result = await importDailyRows(rows, options);
        return res.status(200).json({ ok: true, mode: 'daily', ...result });
      } catch (err) {
        console.error('POST import error:', err);
        return res.status(500).json({ error: err.message || 'Import failed' });
      }
    }

    const row = buildRow(body);
    const department = row.department || 'all_pos';
    if (!getDepartment(department)) {
      return res.status(400).json({ error: 'Invalid department' });
    }

    if (body.is_correction === true) {
      const correctionField = String(body.correction_field || '').trim();
      const correctionReason = String(body.correction_reason || '').trim();
      if (!correctionField || !correctionReason) {
        return res.status(400).json({
          error: 'Correction field and reason are required when re-uploading a corrected entry.',
        });
      }
    }

    if (!row.report_date) {
      return res.status(400).json({ error: 'Report date is required' });
    }

    const deptRequired = requiredForDepartment(department);
    for (const key of deptRequired) {
      if (key === 'report_date') continue;
      const val = row[key];
      if (val == null || val === '') {
        const label = getDepartment(department).shortLabel || department;
        return res.status(400).json({ error: `Missing required field for ${label}: ${key}` });
      }
    }

    if (department === 'all_pos') {
      if (!row.nett_sales && !row.total_sales) {
        return res.status(400).json({ error: 'Nett Sales or Total Sales is required' });
      }
      if (!row.total_covers) {
        return res.status(400).json({ error: 'Total # of Covers is required' });
      }
    }

    let receiptImages;
    try {
      const incoming = sanitizeReceiptImages(body.receipt_images);
      const existingResult = await query(
        'SELECT receipt_images FROM daily_z_reports WHERE report_date = $1 AND department = $2',
        [row.report_date, department],
      );
      let existingImages = existingResult.rows[0]?.receipt_images || [];
      if (typeof existingImages === 'string') {
        try { existingImages = JSON.parse(existingImages); } catch { existingImages = []; }
      }
      receiptImages = mergeReceiptImages(existingImages, incoming);
    } catch (imgErr) {
      return res.status(400).json({ error: imgErr.message });
    }
    if (!receiptImages.length) {
      return res.status(400).json({
        error: 'At least one POS receipt photo is required. Attach receipt image(s) to verify the data before saving.',
      });
    }
    row.receipt_images = JSON.stringify(receiptImages);

    if (!row.nett_sales && row.total_sales) row.nett_sales = row.total_sales;
    if (!row.avg_covers && row.nett_sales && row.total_covers) {
      row.avg_covers = Math.round(row.nett_sales / row.total_covers);
    }

    const keys = Object.keys(row);
    const values = keys.map((k) => row[k]);
    const placeholders = keys.map((_, i) => `$${i + 1}`);
    const updates = keys
      .filter((k) => k !== 'report_date' && k !== 'department')
      .map((k) => `${k} = EXCLUDED.${k}`);

    try {
      const result = await query(
        `INSERT INTO daily_z_reports (${keys.join(', ')})
         VALUES (${placeholders.join(', ')})
         ON CONFLICT (report_date, department) DO UPDATE SET ${updates.join(', ')}
         RETURNING *`,
        values,
      );

      let monthlyActuals = null;
      try {
        monthlyActuals = await resyncActualsCascadeFrom(String(row.report_date).slice(0, 7));
      } catch (syncErr) {
        console.error('Monthly actuals sync failed:', syncErr);
      }

      return res.status(201).json({
        data: legacyAliases(normalizeRow(result.rows[0])),
        monthly_actuals: monthlyActuals
          ? { period: monthlyActuals.period, revenue: monthlyActuals.revenue, guests: monthlyActuals.guests }
          : null,
      });
    } catch (err) {
      console.error('POST /api/metrics error:', err);
      return res.status(500).json({ error: 'Insert failed', detail: err.message });
    }
  }

  if (req.method === 'DELETE') {
    if (!checkAdmin(req, res)) return;

    const period = req.query.period ? String(req.query.period).slice(0, 7) : null;
    const reportDate = req.query.report_date || req.query.date;
    const importedOnly = req.query.scope === 'imported' || req.query.imported_only === '1';

    try {
      if (period && !reportDate) {
        const result = await deleteMonthImported(period);
        return res.status(200).json({ ok: true, ...result });
      }

      if (!reportDate) {
        return res.status(400).json({ error: 'report_date or period is required' });
      }

      const result = await deleteZReport(reportDate, { importedOnly });
      if (!result.deleted) {
        return res.status(result.reason === 'not_found' ? 404 : 409).json(result);
      }
      return res.status(200).json({ ok: true, ...result });
    } catch (err) {
      console.error('DELETE /api/metrics error:', err);
      return res.status(500).json({ error: 'Delete failed', detail: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
