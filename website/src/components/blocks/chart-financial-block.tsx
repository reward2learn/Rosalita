'use client';

import { Suspense, useCallback, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import ButtonGroup from '@mui/material/ButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { FinancialChart } from '@/components/charts/financial-chart';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import {
  CHART_KPIS,
  KPI_LABELS,
  SCENARIO_TARGETS,
  labelToPeriod,
} from '@/lib/chart-utils';
import type { ForecastScenarioKey } from '@/domain/financial/financial-projection-service';
import { useChartMonthSync } from '@/hooks/use-chart-month-sync';
import { useGetChartOverviewQuery } from '@/store/apis/financial-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import {
  setChartKpi,
  setChartScenario,
  setSelectedMonth,
  type ChartKpi,
} from '@/store/ui-slice';

const VALID_KPIS: ChartKpi[] = ['ebitda', 'revenue', 'net_income', 'guests', 'staff_cost'];
const SCENARIOS: ForecastScenarioKey[] = ['conservative', 'realistic', 'aspirational'];

function parseKpiParam(value: string | null): ChartKpi {
  if (value && VALID_KPIS.includes(value as ChartKpi)) return value as ChartKpi;
  return 'ebitda';
}

export function ChartFinancialBlock({ config }: { config: Record<string, unknown> }) {
  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress size={28} />
        </Box>
      }
    >
      <ChartFinancialBlockInner config={config} />
    </Suspense>
  );
}

function ChartFinancialBlockInner({ config }: { config: Record<string, unknown> }) {
  const parsed = parseBlockConfig('chart_financial', config);
  const variant = parsed.variant ?? 'dashboard';
  const height = parsed.height ?? (variant === 'ops' ? 320 : 300);
  const dispatch = useAppDispatch();
  const searchParams = useSearchParams();

  const chartKpi = useAppSelector((s) => s.ui.chartKpi);
  const chartScenario = useAppSelector((s) => s.ui.chartScenario);
  const selectedMonthLabel = useAppSelector((s) => s.ui.selectedMonthLabel);

  const scenario: ForecastScenarioKey =
    chartScenario ?? (parsed.scenario === 'actual' ? 'conservative' : parsed.scenario ?? 'conservative');

  const conservativeQ = useGetChartOverviewQuery('conservative');
  const realisticQ = useGetChartOverviewQuery('realistic', { skip: variant !== 'ops' });
  const aspirationalQ = useGetChartOverviewQuery('aspirational', { skip: variant !== 'ops' });
  const dashboardQ = useGetChartOverviewQuery(scenario, { skip: variant === 'ops' });

  const primaryData =
    variant === 'ops' ? conservativeQ.data?.data : dashboardQ.data?.data;

  useChartMonthSync(primaryData, variant === 'ops');

  useEffect(() => {
    const kpiParam = searchParams.get('kpi');
    const scenarioParam = searchParams.get('scenario');
    if (kpiParam) dispatch(setChartKpi(parseKpiParam(kpiParam)));
    if (scenarioParam && SCENARIOS.includes(scenarioParam as ForecastScenarioKey)) {
      dispatch(setChartScenario(scenarioParam as ForecastScenarioKey));
    }
  }, [searchParams, dispatch]);

  const isLoading =
    variant === 'ops'
      ? conservativeQ.isLoading || realisticQ.isLoading || aspirationalQ.isLoading
      : dashboardQ.isLoading;

  const isError =
    variant === 'ops'
      ? conservativeQ.isError || realisticQ.isError || aspirationalQ.isError
      : dashboardQ.isError;

  const labels = primaryData?.labels ?? [];
  const kpi = chartKpi;
  const actualSeries = primaryData?.actual?.[kpi] ?? [];
  const forecastSeries = primaryData?.forecast?.[kpi] ?? [];

  const selectedIndex = useMemo(() => {
    if (!selectedMonthLabel || !labels.length) return null;
    const idx = labels.indexOf(selectedMonthLabel);
    return idx >= 0 ? idx : null;
  }, [selectedMonthLabel, labels]);

  const scenarioForecasts = useMemo(() => {
    if (variant !== 'ops') return undefined;
    return {
      conservative: conservativeQ.data?.data?.forecast?.[kpi],
      realistic: realisticQ.data?.data?.forecast?.[kpi],
      aspirational: aspirationalQ.data?.data?.forecast?.[kpi],
    };
  }, [variant, kpi, conservativeQ.data, realisticQ.data, aspirationalQ.data]);

  const updateUrl = useCallback((params: Record<string, string | null>) => {
    const url = new URL(globalThis.location.href);
    for (const [key, val] of Object.entries(params)) {
      if (val) url.searchParams.set(key, val);
      else url.searchParams.delete(key);
    }
    globalThis.history.replaceState(null, '', url.toString());
  }, []);

  const handleKpiChange = (next: ChartKpi) => {
    dispatch(setChartKpi(next));
    updateUrl({ kpi: next });
  };

  const handleScenarioChange = (next: ForecastScenarioKey) => {
    dispatch(setChartScenario(next));
    updateUrl({ scenario: next });
  };

  const handleMonthClick = (index: number | null, label: string | null) => {
    if (index == null || !label) {
      dispatch(setSelectedMonth({ label: null, period: null }));
      updateUrl({ month: null });
      return;
    }
    dispatch(
      setSelectedMonth({
        label,
        period: labelToPeriod(label),
      }),
    );
    updateUrl({ month: label.replace(' ', '+') });
  };

  const targets = SCENARIO_TARGETS[kpi] ?? SCENARIO_TARGETS.ebitda;
  const kpiFilters = variant === 'dashboard' ? CHART_KPIS : VALID_KPIS;

  return (
    <Box component="section" sx={{ maxWidth: 900, mx: 'auto', px: 3, py: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
          {variant === 'ops' ? 'Financial Projections' : 'Profitability Overview'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.78rem' }}>
          {variant === 'ops'
            ? 'Actual operational KPIs compared against business review projections.'
            : `Monthly ${KPI_LABELS[kpi]} — Actual vs Forecast`}
        </Typography>

        <ButtonGroup size="small" sx={{ mb: variant === 'dashboard' ? 2 : 1 }}>
          {kpiFilters.map((key) => (
            <Button
              key={key}
              variant={kpi === key ? 'contained' : 'outlined'}
              onClick={() => handleKpiChange(key)}
              sx={{ textTransform: 'none', fontSize: '0.82rem' }}
            >
              {KPI_LABELS[key]}
            </Button>
          ))}
        </ButtonGroup>

        {variant === 'ops' ? (
          <ButtonGroup size="small" sx={{ mb: 2, display: 'flex', flexWrap: 'wrap' }}>
            {SCENARIOS.map((s) => (
              <Button
                key={s}
                variant={scenario === s ? 'contained' : 'outlined'}
                onClick={() => handleScenarioChange(s)}
                sx={{ textTransform: 'capitalize', flex: 1, fontSize: '0.82rem' }}
              >
                {s}
              </Button>
            ))}
          </ButtonGroup>
        ) : null}
      </Box>

      {variant === 'dashboard' ? (
        <Box sx={{ display: 'flex', gap: 1.25, mb: 2, flexWrap: 'wrap' }}>
          {(['conservative', 'realistic', 'aspirational'] as const).map((key) => (
            <Paper
              key={key}
              elevation={0}
              sx={{
                flex: 1,
                minWidth: 130,
                p: 1.5,
                bgcolor: 'rgba(255,255,255,0.03)',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  display: 'block',
                  mb: 0.5,
                }}
              >
                {key.charAt(0).toUpperCase() + key.slice(1)}
              </Typography>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                {targets[key]}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Target {targets.label}
              </Typography>
            </Paper>
          ))}
        </Box>
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: 2,
          bgcolor: '#1a1a22',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: 2,
          mb: 1,
        }}
      >
        <FinancialChart
          kpi={kpi}
          labels={labels}
          actual={actualSeries}
          forecast={forecastSeries}
          scenarioForecasts={scenarioForecasts}
          variant={variant}
          height={height}
          selectedIndex={selectedIndex}
          onMonthClick={handleMonthClick}
          isLoading={isLoading}
          isError={isError}
        />
      </Paper>

      <Box
        sx={{
          display: 'flex',
          gap: 1,
          flexWrap: 'wrap',
          fontSize: '0.72rem',
          color: 'text.secondary',
          alignItems: 'center',
        }}
      >
        <LegendDot color="#22c55e" label="Actual" />
        <LegendDot color="#f59e0b" label="Forecast" />
        <LegendDot color="#3b82f6" label="Cumulative" />
        <LegendDot color="rgba(255,255,255,0.08)" label="Current month" />
        {selectedMonthLabel ? (
          <Typography
            component="span"
            variant="caption"
            sx={{ ml: 'auto', color: 'primary.main' }}
          >
            ▶ {selectedMonthLabel}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      <Box
        component="span"
        sx={{ width: 10, height: 10, borderRadius: 0.5, bgcolor: color, display: 'inline-block' }}
      />
      {label}
    </Box>
  );
}
