/**
 * Consolidate daily_z_reports + monthly cost inputs into financial_projections (scenario=actual).
 */
import { query } from './db.js';
import {
  num,
  isExcelLedgerMonth,
  getManualInputs,
  getYtdTotalsBefore,
  buildComputedPnl,
  buildPnlLinesFromValues,
} from './pnl-actuals.js';

function monthBounds(period) {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end, year: y, month: m };
}

export function periodFromDate(dateStr) {
  return String(dateStr).slice(0, 7);
}

export async function aggregateZReportsForMonth(period) {
  const { start, end } = monthBounds(period);
  const result = await query(
    `SELECT
       COUNT(DISTINCT report_date)::int AS days_count,
       COALESCE(SUM(nett_sales), 0) AS revenue,
       COALESCE(SUM(total_covers), 0)::int AS guests,
       COALESCE(SUM(gofood_amount), 0) AS gofood_revenue,
       COALESCE(SUM(dine_in_amount), 0) AS dine_in_amount,
       COALESCE(SUM(group_food_amount), 0) AS food_revenue,
       COALESCE(SUM(group_beverage_amount), 0) AS beverage_revenue,
       COALESCE(SUM(tax_10_amount), 0) AS tax_10,
       COALESCE(SUM(service_7_amount), 0) AS service_7,
       COALESCE(SUM(total_item_discount_amount), 0) AS discounts,
       COALESCE(SUM(pre_send_void_amount), 0) + COALESCE(SUM(post_send_void_amount), 0) AS voids,
       ROUND(AVG(avg_covers)) AS avg_spend
     FROM daily_z_reports d
     WHERE report_date >= $1::date AND report_date < $2::date
       AND (
         d.department != 'all_pos'
         OR NOT EXISTS (
           SELECT 1 FROM daily_z_reports d2
           WHERE d2.report_date = d.report_date
             AND d2.report_date >= $1::date AND d2.report_date < $2::date
             AND d2.department != 'all_pos'
         )
       )`,
    [start, end],
  );

  const row = result.rows[0];
  if (!row || !row.days_count) return null;

  return {
    period,
    days_count: row.days_count,
    revenue: num(row.revenue) || 0,
    guests: num(row.guests) || 0,
    gofood_revenue: num(row.gofood_revenue) || 0,
    dine_in_amount: num(row.dine_in_amount) || 0,
    food_revenue: num(row.food_revenue) || 0,
    beverage_revenue: num(row.beverage_revenue) || 0,
    tax_10: num(row.tax_10) || 0,
    service_7: num(row.service_7) || 0,
    discounts: num(row.discounts) || 0,
    voids: num(row.voids) || 0,
    avg_spend: num(row.avg_spend),
  };
}

export async function aggregateAllZReportMonths() {
  const result = await query(
    `SELECT TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS period
     FROM daily_z_reports
     GROUP BY 1
     ORDER BY 1`,
  );
  const out = {};
  for (const { period } of result.rows) {
    const agg = await aggregateZReportsForMonth(period);
    if (agg) out[period] = agg;
  }
  return out;
}

/** Lightweight monthly KPI map for chart overlays */
export async function aggregateZReportKpisByMonth() {
  const result = await query(
    `SELECT
       TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS period,
       COALESCE(SUM(nett_sales), 0) AS revenue,
       COALESCE(SUM(total_covers), 0)::int AS guests,
       COUNT(*)::int AS days_count
     FROM daily_z_reports
     GROUP BY 1
     ORDER BY 1`,
  );
  const out = {};
  for (const row of result.rows) {
    out[row.period] = {
      revenue: num(row.revenue),
      guests: num(row.guests),
      days_count: row.days_count,
    };
  }
  return out;
}

export async function syncMonthlyActuals(period) {
  if (isExcelLedgerMonth(period)) return null;

  const agg = await aggregateZReportsForMonth(period);
  const manualInputs = await getManualInputs(period);
  const hasManual = manualInputs && Object.keys(manualInputs).length > 0;
  if (!agg && !hasManual) return null;

  const { year, month } = monthBounds(period);
  const ytdBefore = await getYtdTotalsBefore(period);
  const values = buildComputedPnl(period, agg, manualInputs, ytdBefore);
  const pnl_lines = buildPnlLinesFromValues(values);

  const revenue = num(values.total_income_idr) ?? (agg ? agg.revenue : 0);
  const guests = num(values.total_guests_month) ?? (agg ? agg.guests : 0);
  const ebitda = num(values.ebitda);
  const net_income = num(values.net_income_pre_tax);
  const staff_cost = num(values.total_staff_cost) ?? 0;

  await query(
    `INSERT INTO financial_projections
       (period, year, month, data_type, scenario, revenue, ebitda, net_income, guests, staff_cost, pnl_lines)
     VALUES ($1, $2, $3, 'actual', 'actual', $4, $5, $6, $7, $8, $9::jsonb)
     ON CONFLICT (period, data_type, scenario)
     DO UPDATE SET
       revenue = EXCLUDED.revenue,
       guests = EXCLUDED.guests,
       pnl_lines = EXCLUDED.pnl_lines,
       ebitda = EXCLUDED.ebitda,
       net_income = EXCLUDED.net_income,
       staff_cost = EXCLUDED.staff_cost`,
    [
      period,
      year,
      month,
      revenue,
      ebitda,
      net_income,
      guests,
      staff_cost,
      JSON.stringify(pnl_lines),
    ],
  );

  return { period, ...(agg || {}), pnl_lines, values };
}

export async function syncMonthlyActualsForDate(dateStr) {
  return resyncMonthlyActuals(periodFromDate(dateStr));
}

/** Re-sync or clear monthly actuals after Z-report changes */
export async function resyncMonthlyActuals(period) {
  if (isExcelLedgerMonth(period)) return null;

  const agg = await aggregateZReportsForMonth(period);
  const manualInputs = await getManualInputs(period);
  const hasManual = manualInputs && Object.keys(manualInputs).length > 0;

  if (agg || hasManual) return syncMonthlyActuals(period);

  await query(
    `DELETE FROM financial_projections
     WHERE period = $1 AND data_type = 'actual' AND scenario = 'actual'`,
    [period],
  );
  return null;
}

/** Re-sync a month and all later actual months in the same year (YTD accumulation). */
export async function resyncActualsCascadeFrom(period) {
  if (isExcelLedgerMonth(period)) return null;

  const primary = await resyncMonthlyActuals(period);
  const [year] = String(period).split('-');
  const later = await query(
    `SELECT DISTINCT period FROM (
       SELECT period FROM monthly_actual_inputs WHERE period LIKE $1 AND period > $2
       UNION
       SELECT period FROM financial_projections
         WHERE period LIKE $1 AND period > $2
           AND data_type = 'actual' AND scenario = 'actual'
       UNION
       SELECT TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS period
         FROM daily_z_reports
         WHERE TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY') = $3
           AND TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') > $2
     ) t
     ORDER BY period`,
    [`${year}-%`, period, year],
  );
  for (const row of later.rows) {
    if (row.period && row.period > period) {
      await resyncMonthlyActuals(row.period);
    }
  }
  return primary;
}

export async function buildActualScenarioPayload(period, existingScenario) {
  if (isExcelLedgerMonth(period)) {
    return existingScenario || { period, lines: [] };
  }

  const agg = await aggregateZReportsForMonth(period);
  const manualInputs = await getManualInputs(period);
  const ytdBefore = await getYtdTotalsBefore(period);
  const values = buildComputedPnl(period, agg, manualInputs, ytdBefore);
  const lines = buildPnlLinesFromValues(values);

  return {
    period,
    data_type: 'actual',
    scenario: 'actual',
    lines,
    revenue: num(values.total_income_idr) ?? agg?.revenue ?? null,
    guests: num(values.total_guests_month) ?? agg?.guests ?? null,
    ebitda: num(values.ebitda) ?? null,
    net_income: num(values.net_income_pre_tax) ?? null,
    staff_cost: num(values.total_staff_cost) ?? null,
    days_count: agg?.days_count ?? null,
    from_z_reports: !!agg,
  };
}

export async function scenarioPayloadFromAggregate(agg, existingScenario) {
  const period = agg?.period || existingScenario?.period;
  if (!period) return existingScenario || { period: null, lines: [] };
  return buildActualScenarioPayload(period, existingScenario);
}
