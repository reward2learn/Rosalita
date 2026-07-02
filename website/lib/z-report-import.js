/**
 * Import / delete daily Z-reports (daily rows + monthly prorate fill).
 */
import { query } from './db.js';
import { Z_REPORT_FIELD_KEYS } from './z-report-schema.js';
import { resyncMonthlyActuals, periodFromDate } from './sync-monthly-actuals.js';
import { toIsoDate, toSqlTimestamp } from './date-utils.js';

const AMOUNT_KEYS = new Set(
  Z_REPORT_FIELD_KEYS.filter((k) =>
    k.endsWith('_amount') || k === 'total_sales' || k === 'estimated_sales'
    || k === 'nett_sales' || k === 'avg_bills' || k === 'avg_covers',
  ),
);

const PRORATE_KEYS = Z_REPORT_FIELD_KEYS.filter((k) =>
  k.endsWith('_qty') || k.endsWith('_amount') || k === 'total_sales' || k === 'estimated_sales'
  || k === 'nett_sales' || k === 'avg_bills' || k === 'avg_covers' || k === 'report_no',
);

const IMPORT_SOURCES = new Set(['xlsx_daily', 'xlsx_prorate']);

function num(v) {
  if (v == null || v === '') return 0;
  const n = Number(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
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

function monthBounds(period) {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end, year: y, month: m, daysInMonth: new Date(y, m, 0).getDate() };
}

function isManualSource(source) {
  return !source || source === 'manual';
}

function sumRowFields(rows, keys) {
  const totals = {};
  for (const key of keys) totals[key] = 0;
  for (const row of rows) {
    for (const key of keys) {
      totals[key] += num(row[key]);
    }
  }
  return totals;
}

function splitProrated(total, parts) {
  if (parts <= 0) return [];
  const base = Math.floor((total / parts) * 100) / 100;
  const amounts = Array(parts).fill(base);
  let allocated = base * parts;
  let remainder = Math.round((total - allocated) * 100) / 100;
  let i = 0;
  while (remainder > 0.009 && i < parts) {
    const step = Math.min(0.01, remainder);
    amounts[i] += step;
    remainder = Math.round((remainder - step) * 100) / 100;
    i++;
  }
  return amounts;
}

function splitProratedInt(total, parts) {
  if (parts <= 0) return [];
  const base = Math.floor(total / parts);
  const amounts = Array(parts).fill(base);
  let remainder = total - base * parts;
  let i = 0;
  while (remainder > 0 && i < parts) {
    amounts[i]++;
    remainder--;
    i++;
  }
  return amounts;
}

function buildProratedDayRow(period, date, sliceIndex, sliceCount, remainder, entrySource) {
  const row = {
    report_date: date,
    entry_source: entrySource,
    raw_text: `[${entrySource}] Monthly fill for ${period} — day ${date} (${sliceIndex + 1}/${sliceCount})`,
  };

  for (const key of PRORATE_KEYS) {
    const total = remainder[key] || 0;
    if (key.endsWith('_qty') || key === 'report_no' || key === 'total_bills' || key === 'total_covers') {
      const parts = splitProratedInt(Math.round(total), sliceCount);
      row[key] = parts[sliceIndex] ?? 0;
    } else {
      const parts = splitProrated(total, sliceCount);
      row[key] = parts[sliceIndex] ?? 0;
    }
  }

  if (!row.nett_sales && row.total_sales) row.nett_sales = row.total_sales;
  if (!row.total_sales && row.nett_sales) row.total_sales = row.nett_sales;
  if (row.nett_sales && row.total_covers && !row.avg_covers) {
    row.avg_covers = Math.round(row.nett_sales / row.total_covers);
  }
  if (row.total_bills && row.nett_sales && !row.avg_bills) {
    row.avg_bills = Math.round(row.nett_sales / row.total_bills);
  }

  return row;
}

async function upsertZReportRow(row, entrySource) {
  const built = {};
  for (const key of Z_REPORT_FIELD_KEYS) {
    if (row[key] !== undefined) built[key] = coerceValue(key, row[key]);
  }
  if (row.raw_text) built.raw_text = String(row.raw_text).trim();
  built.entry_source = entrySource;

  if (!built.report_date) throw new Error('report_date is required');
  if (!built.department) built.department = 'all_pos';
  if (!built.nett_sales && !built.total_sales) {
    throw new Error(`Nett Sales required for ${built.report_date}`);
  }
  if (!built.total_covers) {
    throw new Error(`Total covers required for ${built.report_date}`);
  }
  if (!built.nett_sales && built.total_sales) built.nett_sales = built.total_sales;
  if (!built.avg_covers && built.nett_sales && built.total_covers) {
    built.avg_covers = Math.round(built.nett_sales / built.total_covers);
  }

  const keys = Object.keys(built);
  const values = keys.map((k) => built[k]);
  const placeholders = keys.map((_, i) => `$${i + 1}`);
  const updates = keys
    .filter((k) => k !== 'report_date' && k !== 'department')
    .map((k) => `${k} = EXCLUDED.${k}`);

  const result = await query(
    `INSERT INTO daily_z_reports (${keys.join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (report_date, department) DO UPDATE SET ${updates.join(', ')}
     RETURNING *`,
    values,
  );
  return result.rows[0];
}

async function getMonthRows(period) {
  const { start, end } = monthBounds(period);
  const result = await query(
    `SELECT * FROM daily_z_reports
     WHERE report_date >= $1::date AND report_date < $2::date
     ORDER BY report_date`,
    [start, end],
  );
  return result.rows;
}

export async function getMonthCalendar(period) {
  const { daysInMonth } = monthBounds(period);
  const rows = await getMonthRows(period);
  const byDate = {};
  rows.forEach((r) => {
    const d = toIsoDate(r.report_date) || String(r.report_date).slice(0, 10);
    byDate[d] = r;
  });

  const filled = [];
  const missing = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${period}-${String(d).padStart(2, '0')}`;
    if (byDate[date]) filled.push({ date, entry_source: byDate[date].entry_source || 'manual' });
    else missing.push(date);
  }

  return {
    period,
    days_in_month: daysInMonth,
    filled,
    missing,
    manual_count: filled.filter((f) => isManualSource(f.entry_source)).length,
    imported_count: filled.filter((f) => IMPORT_SOURCES.has(f.entry_source)).length,
  };
}

export async function importDailyRows(rows, options = {}) {
  const {
    fillMissingOnly = true,
    overwriteImported = true,
    entrySource = 'xlsx_daily',
  } = options;

  const imported = [];
  const skipped = [];
  const errors = [];
  const periods = new Set();

  for (const raw of rows) {
    const date = coerceValue('report_date', raw.report_date || raw.date);
    if (!date) {
      errors.push({ row: raw, error: 'Missing report_date' });
      continue;
    }

    try {
      const existing = await query(
        'SELECT report_date, entry_source FROM daily_z_reports WHERE report_date = $1',
        [date],
      );
      const ex = existing.rows[0];

      if (ex) {
        if (isManualSource(ex.entry_source) && fillMissingOnly) {
          skipped.push({ date, reason: 'manual_entry_exists' });
          continue;
        }
        if (IMPORT_SOURCES.has(ex.entry_source) && !overwriteImported) {
          skipped.push({ date, reason: 'imported_entry_exists' });
          continue;
        }
        if (isManualSource(ex.entry_source) && !fillMissingOnly && !overwriteImported) {
          skipped.push({ date, reason: 'manual_entry_exists' });
          continue;
        }
      }

      const row = { ...raw, report_date: date };
      if (!row.raw_text) {
        row.raw_text = `[${entrySource}] Imported from XLSX on ${new Date().toISOString().slice(0, 10)}`;
      }
      const saved = await upsertZReportRow(row, entrySource);
      imported.push(saved);
      periods.add(periodFromDate(date));
    } catch (err) {
      errors.push({ date, error: err.message });
    }
  }

  for (const period of periods) {
    await resyncMonthlyActuals(period);
  }

  return { imported: imported.length, skipped, errors, periods: [...periods] };
}

export async function importMonthlyProrate(period, monthlyTotals, options = {}) {
  const {
    fillMissingOnly = true,
    overwriteImported = true,
  } = options;

  const { daysInMonth } = monthBounds(period);
  const existingRows = await getMonthRows(period);
  const manualRows = existingRows.filter((r) => isManualSource(r.entry_source));
  const manualSum = sumRowFields(manualRows, PRORATE_KEYS);

  const remainder = {};
  for (const key of PRORATE_KEYS) {
    remainder[key] = num(monthlyTotals[key]) - (manualSum[key] || 0);
  }

  if (num(monthlyTotals.nett_sales) && remainder.nett_sales < 0) {
    throw new Error('Monthly nett sales is less than sum of existing manual entries');
  }

  const targetDates = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${period}-${String(d).padStart(2, '0')}`;
    const ex = existingRows.find((r) => (toIsoDate(r.report_date) || String(r.report_date).slice(0, 10)) === date);
    if (!ex) {
      targetDates.push(date);
    } else if (IMPORT_SOURCES.has(ex.entry_source) && overwriteImported) {
      targetDates.push(date);
    } else if (ex && isManualSource(ex.entry_source) && !fillMissingOnly) {
      targetDates.push(date);
    }
  }

  if (!targetDates.length) {
    return {
      imported: 0,
      skipped: [{ reason: 'no_target_days' }],
      errors: [],
      periods: [period],
    };
  }

  const imported = [];
  const errors = [];

  for (let i = 0; i < targetDates.length; i++) {
    const date = targetDates[i];
    try {
      const row = buildProratedDayRow(period, date, i, targetDates.length, remainder, 'xlsx_prorate');
      const saved = await upsertZReportRow(row, 'xlsx_prorate');
      imported.push(saved);
    } catch (err) {
      errors.push({ date, error: err.message });
    }
  }

  await resyncMonthlyActuals(period);

  return {
    imported: imported.length,
    skipped: [],
    errors,
    periods: [period],
    target_dates: targetDates,
  };
}

export async function deleteZReport(reportDate, options = {}) {
  const { importedOnly = false } = options;
  const date = toIsoDate(reportDate) || String(reportDate).slice(0, 10);
  const period = periodFromDate(date);

  const existing = await query(
    'SELECT report_date, entry_source FROM daily_z_reports WHERE report_date = $1',
    [date],
  );
  const row = existing.rows[0];
  if (!row) {
    return { deleted: false, reason: 'not_found', period };
  }

  if (importedOnly && isManualSource(row.entry_source)) {
    return { deleted: false, reason: 'manual_entry_protected', period };
  }

  await query('DELETE FROM daily_z_reports WHERE report_date = $1', [date]);
  await resyncMonthlyActuals(period);

  return { deleted: true, report_date: date, period, entry_source: row.entry_source };
}

export async function deleteMonthImported(period) {
  const { start, end } = monthBounds(period);
  const result = await query(
    `DELETE FROM daily_z_reports
     WHERE report_date >= $1::date AND report_date < $2::date
       AND entry_source IN ('xlsx_daily', 'xlsx_prorate')
     RETURNING report_date`,
    [start, end],
  );
  await resyncMonthlyActuals(period);
  return {
    deleted: result.rows.length,
    dates: result.rows.map((r) => toIsoDate(r.report_date) || String(r.report_date).slice(0, 10)),
    period,
  };
}
