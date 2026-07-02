'use client';

import { useCallback, useMemo, useRef } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Filler,
  type ChartEvent,
  type ActiveElement,
  type Chart as ChartInstance,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';
import type { ChartOverview } from '@/domain/financial/financial-projection-service';
import {
  axisTickCallback,
  findCurrentMonthIndex,
  formatChartValue,
} from '@/lib/chart-utils';
import type { ChartKpi } from '@/store/ui-slice';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  BarController,
  LineController,
  Tooltip,
  Legend,
  Filler,
);

export interface FinancialChartProps {
  kpi: ChartKpi;
  labels: string[];
  actual: (number | null)[];
  forecast: (number | null)[];
  scenarioForecasts?: {
    conservative?: (number | null)[];
    realistic?: (number | null)[];
    aspirational?: (number | null)[];
  };
  variant?: 'dashboard' | 'ops';
  height?: number;
  selectedIndex?: number | null;
  onMonthClick?: (index: number | null, label: string | null) => void;
  isLoading?: boolean;
  isError?: boolean;
}

function buildBarSeries(
  labels: string[],
  actual: (number | null)[],
  forecast: (number | null)[],
): { barData: number[]; barColors: string[]; cumulative: number[] } {
  const barData: number[] = [];
  const barColors: string[] = [];
  const cumulative: number[] = [];
  let running = 0;

  for (let i = 0; i < labels.length; i++) {
    const act = actual[i];
    const fct = forecast[i];
    const val = act != null ? act : fct != null ? fct : 0;
    barData.push(val);
    barColors.push(act != null ? '#22c55e' : '#f59e0b');
    running += val;
    cumulative.push(running);
  }

  return { barData, barColors, cumulative };
}

export function FinancialChart({
  kpi,
  labels,
  actual,
  forecast,
  scenarioForecasts,
  variant = 'dashboard',
  height = 300,
  selectedIndex = null,
  onMonthClick,
  isLoading = false,
  isError = false,
}: FinancialChartProps) {
  const chartRef = useRef<ChartInstance<'bar'> | null>(null);
  const currentMonthIdx = useMemo(() => findCurrentMonthIndex(labels), [labels]);

  const { barData, barColors, cumulative } = useMemo(
    () => buildBarSeries(labels, actual, forecast),
    [labels, actual, forecast],
  );

  const chartData = useMemo(() => {
    if (variant === 'ops' && scenarioForecasts) {
      return {
        labels,
        datasets: [
          {
            type: 'bar' as const,
            label: 'Actual',
            data: actual,
            backgroundColor: '#eb3d28',
            borderColor: '#eb3d28',
            borderWidth: 1,
            borderRadius: 3,
            order: 2,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: 'Conservative',
            data: scenarioForecasts.conservative ?? [],
            backgroundColor: '#22c55e',
            borderColor: '#22c55e',
            borderWidth: 1,
            borderRadius: 3,
            order: 2,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: 'Realistic',
            data: scenarioForecasts.realistic ?? [],
            backgroundColor: '#f59e0b',
            borderColor: '#f59e0b',
            borderWidth: 1,
            borderRadius: 3,
            order: 2,
            yAxisID: 'y',
          },
          {
            type: 'bar' as const,
            label: 'Aspirational',
            data: scenarioForecasts.aspirational ?? [],
            backgroundColor: '#8b5cf6',
            borderColor: '#a78bfa',
            borderWidth: 2,
            borderRadius: 3,
            order: 2,
            yAxisID: 'y',
            maxBarThickness: 14,
          },
          {
            type: 'line' as const,
            label: 'Cumulative',
            data: cumulative,
            borderColor: '#3b82f6',
            backgroundColor: 'rgba(59,130,246,0.1)',
            borderWidth: 2,
            pointRadius: 2,
            pointBackgroundColor: '#3b82f6',
            tension: 0.3,
            fill: true,
            order: 1,
            yAxisID: 'y1',
          },
        ],
      };
    }

    return {
      labels,
      datasets: [
        {
          type: 'bar' as const,
          label: 'Monthly',
          data: barData,
          backgroundColor: barColors,
          borderColor: barColors,
          borderWidth: 1,
          borderRadius: 3,
          order: 2,
          yAxisID: 'y',
        },
        {
          type: 'line' as const,
          label: 'Cumulative',
          data: cumulative,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59,130,246,0.1)',
          borderWidth: 2,
          pointRadius: 2,
          pointBackgroundColor: '#3b82f6',
          tension: 0.3,
          fill: true,
          order: 1,
          yAxisID: 'y1',
        },
      ],
    };
  }, [variant, scenarioForecasts, labels, actual, cumulative, barData, barColors]);

  const currentMonthPlugin = useMemo(
    () => ({
      id: 'currentMonthLine',
      afterDraw: (chart: ChartInstance) => {
        if (currentMonthIdx < 0) return;
        const meta = chart.getDatasetMeta(0);
        const bar = meta.data[currentMonthIdx];
        if (!bar) return;
        const yScale = chart.scales.y;
        if (!yScale) return;
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        const barWidth = 'width' in bar && typeof bar.width === 'number' ? bar.width : 12;
        ctx.fillRect(bar.x - barWidth, yScale.top, barWidth * 2, yScale.bottom - yScale.top);
        ctx.restore();
      },
    }),
    [currentMonthIdx],
  );

  const handleClick = useCallback(
    (event: ChartEvent, elements: ActiveElement[]) => {
      if (!onMonthClick) return;
      if (elements.length > 0) {
        const idx = elements[0].index;
        onMonthClick(idx, labels[idx] ?? null);
      } else {
        onMonthClick(null, null);
      }
    },
    [labels, onMonthClick],
  );

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' as const },
      onClick: handleClick,
      plugins: {
        legend: {
          display: variant === 'ops',
          labels: { color: '#888', boxWidth: 14, padding: 12, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1a1a22',
          titleColor: '#f0f0f5',
          bodyColor: '#888',
          borderColor: 'rgba(255,255,255,0.08)',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 6,
          callbacks: {
            label: (context: { dataset: { label?: string }; parsed: { y: number | null } }) => {
              const val = context.parsed.y;
              if (context.dataset.label === 'Cumulative') {
                return `Cumulative: ${formatChartValue(kpi, val)}`;
              }
              return `${context.dataset.label ?? ''}: ${formatChartValue(kpi, val)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#8888a0', font: { size: 9 }, maxRotation: 45 },
        },
        y: {
          position: 'left' as const,
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: {
            color: '#8888a0',
            font: { size: 9 },
            callback: (val: number | string) => axisTickCallback(kpi, val),
          },
        },
        y1: {
          position: 'right' as const,
          grid: { display: false },
          ticks: {
            color: '#8888a0',
            font: { size: 9 },
            callback: (val: number | string) => axisTickCallback(kpi, val),
          },
        },
      },
    }),
    [handleClick, kpi, variant],
  );

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height }}>
        <CircularProgress size={32} color="primary" />
      </Box>
    );
  }

  if (isError) {
    return (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', pt: 8 }}>
        Chart data unavailable
      </Typography>
    );
  }

  if (!labels.length) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          gap: 1,
          px: 2,
        }}
      >
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          No chart data yet
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 360 }}>
          Run <code>bun run seed</code> against production Postgres (see AGENTS.md) to load Excel
          projections.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height, position: 'relative' }}>
      <Chart
        ref={chartRef}
        type="bar"
        data={chartData}
        options={options}
        plugins={[currentMonthPlugin]}
        redraw={selectedIndex != null}
      />
    </Box>
  );
}

export type { ChartOverview };
