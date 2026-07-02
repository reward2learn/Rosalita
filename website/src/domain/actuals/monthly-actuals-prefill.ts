import type { DbClient } from '@/lib/db';
import {
  isExcelLedgerMonth,
  lineValueFromPnlLines,
  manualFieldKeys,
  num,
  parsePnlLines,
  sanitizeManualInputs,
} from '@/domain/financial/pnl-calculator';
import type { ZMonthAggregate } from '@/domain/financial/pnl-calculator';
import { SyncMonthlyActuals } from '@/domain/actuals/sync-monthly-actuals';

export const NET_INCOME_RATIOS: Record<string, number> = {
  purchases_food: 0.6 * 0.30,
  purchases_beverage: 0.4 * 0.27,
  costs_entertainment: 0.02,
  other_direct: 0.022,
  advertising: 0.025,
  marketing_material: 0.005,
  repairs: 0.02,
  electric_gas: 0.06,
  bank_fees: 0.0175,
  communication: 0.005,
  sundry: 0.02,
};

const COPY_PRIOR_KEYS = [
  'staff_mgmt_count', 'staff_dj_count', 'staff_reception_count', 'staff_waiter_count',
  'staff_bar_count', 'staff_kitchen_count', 'staff_store_count',
  'admin_fees', 'body_corporate', 'rents_leases', 'starpoints_addback',
];

const STAFF_WAGE_CONFIG = [
  { count: 'staff_mgmt_count', cost: 'staff_mgmt_cost', rate: 15_000_000 },
  { count: 'staff_dj_count', cost: 'staff_dj_cost', rate: 5_500_000 },
  { count: 'staff_reception_count', cost: 'staff_reception_cost', rate: 5_500_000 },
  { count: 'staff_waiter_count', cost: 'staff_waiter_cost', rate: 4_000_000 },
  { count: 'staff_bar_count', cost: 'staff_bar_cost', rate: 4_500_000 },
  { count: 'staff_kitchen_count', cost: 'staff_kitchen_cost', rate: 5_000_000 },
  { count: 'staff_store_count', cost: 'staff_store_cost', rate: 3_500_000 },
];

const STAFF_WAGE_MULTIPLIER = 1.1;
const STAFF_TRAVEL_RATIO = 0.1;

export function priorPeriod(period: string): string {
  const [y, m] = String(period).split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

function inputsFromPnlLines(lines: ReturnType<typeof parsePnlLines>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of manualFieldKeys()) {
    const v = lineValueFromPnlLines(lines, key);
    if (v != null) out[key] = key.endsWith('_count') ? Math.round(v) : v;
  }
  return out;
}

function applyRevenueRatios(out: Record<string, number>, netIncome: number | null) {
  if (netIncome == null || netIncome <= 0) return;
  for (const [key, ratio] of Object.entries(NET_INCOME_RATIOS)) {
    out[key] = Math.round(netIncome * ratio);
  }
}

function scaleRevenueLinkedFromPrior(
  out: Record<string, number>,
  priorInputs: Record<string, number>,
  currentNet: number | null,
  priorNet: number | null,
) {
  if (!priorNet || priorNet <= 0 || !currentNet || currentNet <= 0) {
    applyRevenueRatios(out, currentNet || priorNet);
    return;
  }
  const factor = currentNet / priorNet;
  for (const key of Object.keys(NET_INCOME_RATIOS)) {
    const base = num(priorInputs[key]);
    if (base != null) {
      out[key] = Math.round(base * factor);
    } else {
      out[key] = Math.round(currentNet * NET_INCOME_RATIOS[key]!);
    }
  }
}

function applyStaffCosts(out: Record<string, number>) {
  let wageSum = 0;
  for (const cfg of STAFF_WAGE_CONFIG) {
    const count = Math.round(num(out[cfg.count]) || 0);
    out[cfg.count] = count;
    if (count > 0) {
      const cost = Math.round(count * cfg.rate * STAFF_WAGE_MULTIPLIER);
      out[cfg.cost] = cost;
      wageSum += cost;
    } else {
      out[cfg.cost] = 0;
    }
  }
  out.staff_travel = wageSum > 0 ? Math.round(wageSum * STAFF_TRAVEL_RATIO) : 0;
}

export class MonthlyActualsPrefill {
  private readonly sync: SyncMonthlyActuals;

  constructor(private readonly db: DbClient) {
    this.sync = new SyncMonthlyActuals(db);
  }

  async getMonthBaseline(period: string) {
    const saved = await this.sync.getManualInputs(period);
    if (saved && Object.keys(saved).length > 0) {
      return { period, inputs: saved, source: 'monthly_actual_inputs' as const };
    }

    const row = await this.db.financialProjection.findUnique({
      where: {
        period_dataType_scenario: { period, dataType: 'actual', scenario: 'actual' },
      },
      select: { pnlLines: true },
    });
    const fromPnl = inputsFromPnlLines(parsePnlLines(row?.pnlLines));
    if (Object.keys(fromPnl).length > 0) {
      const label = isExcelLedgerMonth(period) ? 'excel' : 'financial_projections';
      return { period, inputs: fromPnl, source: label as 'excel' | 'financial_projections' };
    }

    return { period, inputs: {}, source: 'none' as const };
  }

  async getPriorMonthBaseline(period: string) {
    const prior = priorPeriod(period);
    const baseline = await this.getMonthBaseline(prior);
    return { prior: baseline.period, inputs: baseline.inputs, source: baseline.source };
  }

  async buildPrefillInputs(
    period: string,
    zAgg: ZMonthAggregate | null | undefined,
    options: { fromPeriod?: string } = {},
  ) {
    const fromPeriod = options.fromPeriod ?? priorPeriod(period);
    const { inputs: priorInputs, source } = await this.getMonthBaseline(fromPeriod);
    const prior = priorInputs as Record<string, number>;
    const out: Record<string, number> = {};

    for (const key of COPY_PRIOR_KEYS) {
      if (prior[key] != null) {
        out[key] = key.endsWith('_count') ? Math.round(prior[key]) : prior[key];
      }
    }

    const currentNet = zAgg?.revenue != null ? num(zAgg.revenue) : null;
    let priorNet: number | null = null;
    const priorRow = await this.db.financialProjection.findUnique({
      where: {
        period_dataType_scenario: { period: fromPeriod, dataType: 'actual', scenario: 'actual' },
      },
      select: { pnlLines: true },
    });
    if (priorRow?.pnlLines) {
      priorNet = lineValueFromPnlLines(parsePnlLines(priorRow.pnlLines), 'net_income_pre_tax');
    }

    if (currentNet != null) {
      scaleRevenueLinkedFromPrior(out, prior, currentNet, priorNet);
    } else if (priorNet != null) {
      applyRevenueRatios(out, priorNet);
    } else {
      for (const key of Object.keys(NET_INCOME_RATIOS)) {
        if (prior[key] != null) out[key] = prior[key];
      }
    }

    applyStaffCosts(out);

    const clean = sanitizeManualInputs(out);
    const sourceLabel = source === 'excel'
      ? `${fromPeriod} (Excel)`
      : source === 'monthly_actual_inputs'
        ? `${fromPeriod} (saved)`
        : source === 'financial_projections'
          ? `${fromPeriod} (P&L)`
          : fromPeriod;

    return {
      inputs: clean,
      prefill_meta: {
        prior_period: fromPeriod,
        prior_source: source,
        prior_label: sourceLabel,
        net_income_used: currentNet ?? priorNet,
        net_income_from: currentNet != null ? 'z_reports' : (priorNet != null ? 'prior_month' : null),
        rents_note: 'Rent copied from prior month — verify if lease changed.',
      },
    };
  }
}
