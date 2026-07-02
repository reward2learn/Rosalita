import type { DbClient } from '@/lib/db';
export type ProjectionDataType = 'actual' | 'forecast';
export type ProjectionScenario = 'actual' | 'conservative' | 'realistic' | 'aspirational';
import { SyncMonthlyActuals, type ScenarioPayload } from '@/domain/actuals/sync-monthly-actuals';
import { isExcelLedgerMonth, parsePnlLines } from '@/domain/financial/pnl-calculator';
import { toIdrInt } from '@/domain/shared/number-utils';

export const SCENARIO_MAP = {
  conservative: { year: 2027, label: 'Conservative', target: 'IDR 101M/mo EBITDA' },
  realistic: { year: 2029, label: 'Realistic', target: 'IDR 150M/mo EBITDA' },
  aspirational: { year: 2030, label: 'Aspirational', target: 'IDR 298M/mo EBITDA' },
} as const;

export type ForecastScenarioKey = keyof typeof SCENARIO_MAP;
export type ScenarioKey = 'actual' | ForecastScenarioKey;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface ProjectionQuery {
  period: string;
  dataType: ProjectionDataType;
  scenario: ProjectionScenario;
}

export function scenarioKeyToQuery(key: ScenarioKey): ProjectionQuery {
  if (key === 'actual') {
    return { period: '', dataType: 'actual', scenario: 'actual' };
  }
  return { period: '', dataType: 'forecast', scenario: key };
}

export function resolveForecastPeriod(
  chartYear: number,
  chartMonth: number,
  scenario: ForecastScenarioKey,
  scenarioCfg: (typeof SCENARIO_MAP)[ForecastScenarioKey],
): string | null {
  const mm = String(chartMonth).padStart(2, '0');

  if (scenario === 'conservative') {
    if (chartYear === 2026 && chartMonth < 6) return null;
    if (chartYear === 2026 || chartYear === 2027) return `${chartYear}-${mm}`;
    return null;
  }

  if (chartYear === 2026 || chartYear === 2027) return `${scenarioCfg.year}-${mm}`;
  return null;
}

export function resolveDbPeriod(chartPeriod: string, scenarioKey: ScenarioKey): string | null {
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

export function groupProjectionsByTypeScenario(
  rows: { dataType: string; scenario: string; [key: string]: unknown }[],
): Map<string, typeof rows> {
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = `${row.dataType}:${row.scenario}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }
  return groups;
}

export interface ChartOverview {
  labels: string[];
  actual: Record<string, (number | null)[]>;
  forecast: Record<string, (number | null)[]>;
  scenario: ForecastScenarioKey;
  scenario_year: number;
  scenario_label: string;
  ebitda_target: string;
}

export interface PnlDetailResponse {
  chart_period: string;
  scenarios: Record<ScenarioKey, ScenarioPayload>;
}

export class FinancialProjectionService {
  private readonly sync: SyncMonthlyActuals;

  constructor(private readonly db: DbClient) {
    this.sync = new SyncMonthlyActuals(db);
  }

  async findByTypeAndScenario(query: ProjectionQuery) {
    return this.db.financialProjection.findUnique({
      where: {
        period_dataType_scenario: {
          period: query.period,
          dataType: query.dataType,
          scenario: query.scenario,
        },
      },
    });
  }

  async getPnlDetail(chartPeriod: string): Promise<PnlDetailResponse> {
    const scenarios = {} as Record<ScenarioKey, ScenarioPayload>;
    const keys: ScenarioKey[] = ['actual', 'conservative', 'realistic', 'aspirational'];

    for (const key of keys) {
      const dbPeriod = resolveDbPeriod(chartPeriod, key);
      if (!dbPeriod) {
        scenarios[key] = { period: null, lines: [] };
        continue;
      }

      const dataType: ProjectionDataType = key === 'actual' ? 'actual' : 'forecast';
      const scenario: ProjectionScenario = key === 'actual' ? 'actual' : key;

      const row = await this.findByTypeAndScenario({ period: dbPeriod, dataType, scenario });

      scenarios[key] = row
        ? {
            period: row.period,
            data_type: row.dataType as ProjectionDataType,
            scenario: row.scenario as ProjectionScenario,
            lines: parsePnlLines(row.pnlLines),
            revenue: toIdrInt(row.revenue),
            ebitda: toIdrInt(row.ebitda),
            net_income: toIdrInt(row.netIncome),
            guests: row.guests,
            staff_cost: toIdrInt(row.staffCost),
          }
        : { period: dbPeriod, lines: [] };
    }

    const zAgg = await this.sync.aggregateZReportsForMonth(chartPeriod);
    if (zAgg) {
      try {
        await this.sync.resyncMonthlyActuals(chartPeriod);
      } catch {
        // non-fatal — mirror legacy warn behavior
      }
      scenarios.actual = await this.sync.buildActualScenarioPayload(chartPeriod, scenarios.actual);
    } else if (!isExcelLedgerMonth(chartPeriod)) {
      scenarios.actual = await this.sync.buildActualScenarioPayload(chartPeriod, scenarios.actual);
    }

    return { chart_period: chartPeriod, scenarios };
  }

  async getChartOverview(scenario: ForecastScenarioKey = 'conservative'): Promise<ChartOverview> {
    const scenarioCfg = SCENARIO_MAP[scenario] ?? SCENARIO_MAP.conservative;

    const rows = await this.db.financialProjection.findMany({
      orderBy: [{ year: 'asc' }, { month: 'asc' }, { dataType: 'asc' }, { scenario: 'asc' }],
    });

    if (!rows.length) {
      return {
        labels: [],
        actual: {},
        forecast: {},
        scenario,
        scenario_year: scenarioCfg.year,
        scenario_label: scenarioCfg.label,
        ebitda_target: scenarioCfg.target,
      };
    }

    const groups = groupProjectionsByTypeScenario(rows);
    const actualRows = groups.get('actual:actual') ?? [];
    const forecastRows = groups.get(`forecast:${scenario}`) ?? [];

    const labels: string[] = [];
    const actual: Record<string, (number | null)[]> = {
      revenue: [], ebitda: [], net_income: [], guests: [], staff_cost: [],
    };
    const forecast: Record<string, (number | null)[]> = {
      revenue: [], ebitda: [], net_income: [], guests: [], staff_cost: [],
    };
    const KPI_KEYS = ['revenue', 'ebitda', 'net_income', 'guests', 'staff_cost'] as const;

    let zKpisByMonth: Record<string, { revenue: number | null; guests: number | null }> = {};
    try {
      zKpisByMonth = await this.sync.aggregateZReportKpisByMonth();
    } catch {
      // overlay optional
    }

    for (let y = 2026; y <= 2027; y++) {
      for (let m = 1; m <= 12; m++) {
        const period = `${y}-${String(m).padStart(2, '0')}`;
        labels.push(`${MONTH_NAMES[m - 1]} ${y}`);

        const actRow = actualRows.find((r) => r.period === period);
        const zKpi = zKpisByMonth[period];
        for (const k of KPI_KEYS) {
          const camelKey = k === 'net_income' ? 'netIncome' : k === 'staff_cost' ? 'staffCost' : k;
          if (zKpi && (k === 'revenue' || k === 'guests') && zKpi[k] != null) {
            actual[k].push(zKpi[k]);
          } else {
            const val = actRow ? (actRow as Record<string, unknown>)[camelKey] : null;
            actual[k].push(val != null ? toIdrInt(val) : null);
          }
        }

        const forecastPeriod = resolveForecastPeriod(y, m, scenario, scenarioCfg);
        const fctRow = forecastPeriod
          ? forecastRows.find((r) => r.period === forecastPeriod)
          : null;
        for (const k of KPI_KEYS) {
          const camelKey = k === 'net_income' ? 'netIncome' : k === 'staff_cost' ? 'staffCost' : k;
          const val = fctRow ? (fctRow as Record<string, unknown>)[camelKey] : null;
          forecast[k].push(val != null ? toIdrInt(val) : null);
        }
      }
    }

    return {
      labels,
      actual,
      forecast,
      scenario,
      scenario_year: scenarioCfg.year,
      scenario_label: scenarioCfg.label,
      ebitda_target: scenarioCfg.target,
    };
  }
}
