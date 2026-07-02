import { describe, it, expect, vi } from 'vitest';
import {
  FinancialProjectionService,
  groupProjectionsByTypeScenario,
  resolveDbPeriod,
  resolveForecastPeriod,
  scenarioKeyToQuery,
  SCENARIO_MAP,
} from '@/domain/financial/financial-projection-service';

describe('FinancialProjectionService scenario resolution', () => {
  describe('resolveDbPeriod', () => {
    it('returns chart period for actual scenario', () => {
      expect(resolveDbPeriod('2026-08', 'actual')).toBe('2026-08');
    });

    it('returns null for conservative before Jun 2026', () => {
      expect(resolveDbPeriod('2026-05', 'conservative')).toBeNull();
    });

    it('returns same period for conservative from Jun 2026', () => {
      expect(resolveDbPeriod('2026-06', 'conservative')).toBe('2026-06');
      expect(resolveDbPeriod('2027-03', 'conservative')).toBe('2027-03');
    });

    it('maps realistic 2026/2027 chart months to 2029 forecast periods', () => {
      expect(resolveDbPeriod('2026-07', 'realistic')).toBe('2029-07');
      expect(resolveDbPeriod('2027-12', 'realistic')).toBe('2029-12');
    });

    it('maps aspirational 2026/2027 chart months to 2030 forecast periods', () => {
      expect(resolveDbPeriod('2026-09', 'aspirational')).toBe('2030-09');
      expect(resolveDbPeriod('2027-01', 'aspirational')).toBe('2030-01');
    });

    it('returns null for realistic outside 2026-2027 chart range', () => {
      expect(resolveDbPeriod('2028-01', 'realistic')).toBeNull();
    });
  });

  describe('resolveForecastPeriod', () => {
    it('aligns conservative forecast with chart year/month', () => {
      expect(resolveForecastPeriod(2026, 8, 'conservative', SCENARIO_MAP.conservative)).toBe('2026-08');
      expect(resolveForecastPeriod(2027, 1, 'conservative', SCENARIO_MAP.conservative)).toBe('2027-01');
    });

    it('returns null for conservative before Jun 2026 on chart', () => {
      expect(resolveForecastPeriod(2026, 5, 'conservative', SCENARIO_MAP.conservative)).toBeNull();
    });

    it('maps realistic chart months to scenario year 2029', () => {
      expect(resolveForecastPeriod(2026, 6, 'realistic', SCENARIO_MAP.realistic)).toBe('2029-06');
      expect(resolveForecastPeriod(2027, 11, 'realistic', SCENARIO_MAP.realistic)).toBe('2029-11');
    });

    it('maps aspirational chart months to scenario year 2030', () => {
      expect(resolveForecastPeriod(2027, 4, 'aspirational', SCENARIO_MAP.aspirational)).toBe('2030-04');
    });
  });

  describe('scenarioKeyToQuery', () => {
    it('requires data_type actual + scenario actual for actuals', () => {
      const q = scenarioKeyToQuery('actual');
      expect(q.dataType).toBe('actual');
      expect(q.scenario).toBe('actual');
    });

    it('requires data_type forecast + matching scenario for forecasts', () => {
      const conservative = scenarioKeyToQuery('conservative');
      expect(conservative.dataType).toBe('forecast');
      expect(conservative.scenario).toBe('conservative');

      const realistic = scenarioKeyToQuery('realistic');
      expect(realistic.dataType).toBe('forecast');
      expect(realistic.scenario).toBe('realistic');
    });
  });

  describe('groupProjectionsByTypeScenario', () => {
    it('groups rows by data_type:scenario composite key', () => {
      const rows = [
        { period: '2026-06', dataType: 'actual' as const, scenario: 'actual' as const },
        { period: '2029-06', dataType: 'forecast' as const, scenario: 'realistic' as const },
        { period: '2027-06', dataType: 'forecast' as const, scenario: 'conservative' as const },
        { period: '2026-07', dataType: 'actual' as const, scenario: 'actual' as const },
      ];

      const groups = groupProjectionsByTypeScenario(rows);
      expect(groups.get('actual:actual')).toHaveLength(2);
      expect(groups.get('forecast:realistic')).toHaveLength(1);
      expect(groups.get('forecast:conservative')).toHaveLength(1);
      expect(groups.get('forecast:actual')).toBeUndefined();
    });

    it('never groups by scenario alone without data_type', () => {
      const rows = [
        { period: '2026-06', dataType: 'actual' as const, scenario: 'actual' as const },
        { period: '2027-06', dataType: 'forecast' as const, scenario: 'conservative' as const },
      ];
      const groups = groupProjectionsByTypeScenario(rows);
      expect(groups.has('conservative')).toBe(false);
      expect(groups.has('forecast:conservative')).toBe(true);
    });
  });

  describe('FinancialProjectionService', () => {
    it('exposes findByTypeAndScenario requiring both keys', async () => {
      const findUnique = vi.fn().mockResolvedValue(null);
      const db = {
        financialProjection: { findUnique },
      } as unknown as ConstructorParameters<typeof FinancialProjectionService>[0];

      const svc = new FinancialProjectionService(db);
      await svc.findByTypeAndScenario({
        period: '2029-07',
        dataType: 'forecast',
        scenario: 'realistic',
      });

      expect(findUnique).toHaveBeenCalledWith({
        where: {
          period_dataType_scenario: {
            period: '2029-07',
            dataType: 'forecast',
            scenario: 'realistic',
          },
        },
      });
    });
  });
});
