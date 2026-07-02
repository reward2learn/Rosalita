/**
 * GET /api/financial-overview
 *   ?scenario=conservative|realistic|aspirational  — chart KPI series (default)
 *   ?period=2027-01                                — full P&L line breakdown for a month
 *   ?resource=monthly-actuals&period=YYYY-MM     — monthly cost inputs (GET/POST, admin)
 *   ?resource=reports&period=daily|weekly|monthly — legacy metrics rollup
 */
import { query } from '../lib/db.js';
import {
  aggregateZReportsForMonth,
  aggregateZReportKpisByMonth,
  scenarioPayloadFromAggregate,
  buildActualScenarioPayload,
  resyncMonthlyActuals,
} from '../lib/sync-monthly-actuals.js';
import { isExcelLedgerMonth } from '../lib/pnl-actuals.js';
import { handleMonthlyActuals } from '../lib/handlers/monthly-actuals.js';
import { handleReports } from '../lib/handlers/reports.js';

const SCENARIO_MAP = {
  conservative: { year: 2027, label: 'Conservative', target: 'IDR 101M/mo EBITDA' },
  realistic:    { year: 2029, label: 'Realistic',    target: 'IDR 150M/mo EBITDA' },
  aspirational: { year: 2030, label: 'Aspirational', target: 'IDR 298M/mo EBITDA' },
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function resolveForecastPeriod(chartYear, chartMonth, scenario, scenarioCfg) {
  const mm = String(chartMonth).padStart(2, '0');

  if (scenario === 'conservative') {
    if (chartYear === 2026 && chartMonth < 6) return null;
    if (chartYear === 2026 || chartYear === 2027) return `${chartYear}-${mm}`;
    return null;
  }

  // Realistic (2029) & aspirational (2030): same calendar month on 2026 and 2027 chart
  if (chartYear === 2026 || chartYear === 2027) return `${scenarioCfg.year}-${mm}`;
  return null;
}

function resolveDbPeriod(chartPeriod, scenarioKey) {
  const [y, m] = chartPeriod.split('-').map(Number);
  const mm = String(m).padStart(2, '0');

  if (scenarioKey === 'actual') return chartPeriod;

  if (scenarioKey === 'conservative') {
    if (y === 2026 && m < 6) return null;
    return `${y}-${mm}`;
  }

  if (y === 2026 || y === 2027) return `${SCENARIO_MAP[scenarioKey].year}-${mm}`;
  return null;
}

async function handlePnlDetail(req, res, chartPeriod) {
  const scenarios = {};
  const keys = ['actual', 'conservative', 'realistic', 'aspirational'];

  for (const key of keys) {
    const dbPeriod = resolveDbPeriod(chartPeriod, key);
    if (!dbPeriod) {
      scenarios[key] = { period: null, lines: [] };
      continue;
    }

    const dataType = key === 'actual' ? 'actual' : 'forecast';
    const scenario = key === 'actual' ? 'actual' : key;

    const result = await query(
      `SELECT period, data_type, scenario, pnl_lines, revenue, ebitda, net_income, guests, staff_cost
       FROM financial_projections
       WHERE period = $1 AND data_type = $2 AND scenario = $3
       LIMIT 1`,
      [dbPeriod, dataType, scenario]
    );

    const row = result.rows?.[0];
    scenarios[key] = row
      ? {
          period: row.period,
          data_type: row.data_type,
          scenario: row.scenario,
          lines: row.pnl_lines || [],
          revenue: row.revenue,
          ebitda: row.ebitda,
          net_income: row.net_income,
          guests: row.guests,
          staff_cost: row.staff_cost,
        }
      : { period: dbPeriod, lines: [] };
  }

  const zAgg = await aggregateZReportsForMonth(chartPeriod);
  if (zAgg) {
    try {
      await resyncMonthlyActuals(chartPeriod);
    } catch (syncErr) {
      console.warn('[financial-overview/pnl] actuals sync:', syncErr.message);
    }
    scenarios.actual = await scenarioPayloadFromAggregate(zAgg, scenarios.actual);
  } else if (!isExcelLedgerMonth(chartPeriod)) {
    scenarios.actual = await buildActualScenarioPayload(chartPeriod, scenarios.actual);
  }

  return res.status(200).json({ chart_period: chartPeriod, scenarios });
}

async function handleOverview(req, res) {
  const scenario = req.query.scenario || 'conservative';
  const scenarioCfg = SCENARIO_MAP[scenario] || SCENARIO_MAP.conservative;

  const result = await query(
    `SELECT period, year, month, data_type, scenario, revenue, ebitda, net_income, guests, staff_cost
     FROM financial_projections
     ORDER BY year, month, data_type, scenario`
  );

  if (!result || !result.rows.length) {
    return res.status(200).json({
      labels: [], actual: {}, forecast: {},
      scenario, scenario_year: scenarioCfg.year,
      scenario_label: scenarioCfg.label, ebitda_target: scenarioCfg.target,
    });
  }

  const groups = {};
  for (const row of result.rows) {
    const key = row.data_type + ':' + row.scenario;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  }

  const actualKey = 'actual:actual';
  const forecastKey = 'forecast:' + scenario;
  const actualRows = groups[actualKey] || [];
  const forecastRows = groups[forecastKey] || [];

  const labels = [];
  const actual = { revenue: [], ebitda: [], net_income: [], guests: [], staff_cost: [] };
  const forecast = { revenue: [], ebitda: [], net_income: [], guests: [], staff_cost: [] };
  const KPI_KEYS = ['revenue', 'ebitda', 'net_income', 'guests', 'staff_cost'];

  let zKpisByMonth = {};
  try {
    zKpisByMonth = await aggregateZReportKpisByMonth();
  } catch (e) {
    console.warn('[financial-overview] Z-report KPI overlay skipped:', e.message);
  }

  for (let y = 2026; y <= 2027; y++) {
    for (let m = 1; m <= 12; m++) {
      const period = `${y}-${String(m).padStart(2, '0')}`;
      labels.push(MONTH_NAMES[m - 1] + ' ' + y);

      const actRow = actualRows.find(r => r.period === period);
      const zKpi = zKpisByMonth[period];
      for (const k of KPI_KEYS) {
        if (zKpi && (k === 'revenue' || k === 'guests') && zKpi[k] != null) {
          actual[k].push(zKpi[k]);
        } else {
          actual[k].push(actRow && actRow[k] != null ? actRow[k] : null);
        }
      }

      const forecastPeriod = resolveForecastPeriod(y, m, scenario, scenarioCfg);
      const fctRow = forecastPeriod
        ? forecastRows.find(r => r.period === forecastPeriod)
        : null;
      for (const k of KPI_KEYS) {
        forecast[k].push(fctRow && fctRow[k] != null ? fctRow[k] : null);
      }
    }
  }

  return res.status(200).json({
    labels, actual, forecast,
    scenario,
    scenario_year: scenarioCfg.year,
    scenario_label: scenarioCfg.label,
    ebitda_target: scenarioCfg.target,
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const resource = req.query.resource;
  if (resource === 'monthly-actuals') {
    return handleMonthlyActuals(req, res);
  }
  if (resource === 'reports') {
    return handleReports(req, res);
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET required' });
  }

  const chartPeriod = req.query.period;
  if (chartPeriod) {
    if (!/^\d{4}-\d{2}$/.test(chartPeriod)) {
      return res.status(400).json({ error: 'period must be YYYY-MM' });
    }
    try {
      return await handlePnlDetail(req, res, chartPeriod);
    } catch (err) {
      console.error('[financial-overview/pnl]', err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  try {
    return await handleOverview(req, res);
  } catch (err) {
    console.error('[financial-overview]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
