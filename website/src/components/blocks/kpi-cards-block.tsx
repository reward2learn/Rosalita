'use client';

import { Suspense, useMemo } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import { MetricCard } from '@/components/ui/metric-card';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import { formatChartValue, resolveMonthIndex } from '@/lib/chart-utils';
import { useChartMonthSync } from '@/hooks/use-chart-month-sync';
import { useGetChartOverviewQuery } from '@/store/apis/financial-api';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setChartKpi, type ChartKpi } from '@/store/ui-slice';

const OPS_KPIS: { key: ChartKpi; label: string }[] = [
  { key: 'revenue', label: 'Revenue' },
  { key: 'ebitda', label: 'EBITDA' },
  { key: 'guests', label: 'Guests / Day' },
  { key: 'staff_cost', label: 'Staff Cost %' },
  { key: 'net_income', label: 'Net Profit' },
];

function getValAtIndex(
  actual: (number | null)[] | undefined,
  forecast: (number | null)[] | undefined,
  idx: number,
): number | null {
  const a = actual?.[idx];
  if (a != null) return a;
  const f = forecast?.[idx];
  return f != null ? f : null;
}

export function KpiCardsBlock({ config }: { config: Record<string, unknown> }) {
  const { variant } = parseBlockConfig('kpi_cards', config);
  if (variant !== 'ops') {
    return null;
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      }
    >
      <KpiCardsBlockInner config={config} />
    </Suspense>
  );
}

function KpiCardsBlockInner({ config }: { config: Record<string, unknown> }) {
  const { variant } = parseBlockConfig('kpi_cards', config);
  const dispatch = useAppDispatch();
  const chartKpi = useAppSelector((s) => s.ui.chartKpi);
  const selectedMonthLabel = useAppSelector((s) => s.ui.selectedMonthLabel);

  const { data, isLoading } = useGetChartOverviewQuery('conservative');
  const overview = data?.data;

  useChartMonthSync(overview, variant === 'ops');

  const monthIndex = useMemo(
    () => resolveMonthIndex(overview?.labels ?? [], selectedMonthLabel),
    [overview?.labels, selectedMonthLabel],
  );

  const label = overview?.labels?.[monthIndex] ?? '—';

  const cards = OPS_KPIS.map(({ key, label: kpiLabel }) => {
    const raw = getValAtIndex(overview?.actual?.[key], overview?.forecast?.[key], monthIndex);
    let display = '—';
    let change = isLoading ? 'Loading…' : `${label} · Forecast`;

    if (raw != null) {
      if (key === 'staff_cost') {
        const rev = getValAtIndex(overview?.actual?.revenue, overview?.forecast?.revenue, monthIndex);
        const pct = rev && rev !== 0 ? ((raw / rev) * 100).toFixed(1) + '%' : '—';
        display = pct;
        change = `${label} · IDR ${Math.round(raw).toLocaleString('en-ID')}`;
      } else if (key === 'guests') {
        display = raw.toFixed(0);
        const isActual = overview?.actual?.guests?.[monthIndex] != null;
        change = `${label} · ${isActual ? 'Actual' : 'Forecast'}`;
      } else {
        display = formatChartValue(key, raw).replace(/^\+/, '');
        const isActual = overview?.actual?.[key]?.[monthIndex] != null;
        change = `${label} · ${isActual ? 'Actual' : 'Forecast'}`;
      }
    }

    return { key, kpiLabel, display, change };
  });

  return (
    <Box component="section" sx={{ maxWidth: 900, mx: 'auto', px: 3, pt: 3 }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(5, 1fr)' },
          gap: 1.75,
        }}
      >
        {cards.map((c) => (
          <MetricCard
            key={c.key}
            label={c.kpiLabel}
            value={c.display}
            change={c.change}
            active={chartKpi === c.key}
            onClick={() => dispatch(setChartKpi(c.key))}
          />
        ))}
      </Box>
    </Box>
  );
}
