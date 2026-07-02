'use client';

import { useMemo } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import { formatIdr } from '@/lib/chart-utils';
import type { PnlLine } from '@/domain/financial/pnl-calculator';
import { useGetChartOverviewQuery, useGetPnlDetailQuery } from '@/store/apis/financial-api';
import { useAppSelector } from '@/store/hooks';

function staffCostPct(revenue: number | null, staffCost: number | null): string {
  if (revenue == null || staffCost == null || revenue === 0) return '—';
  return `${((staffCost / revenue) * 100).toFixed(1)}%`;
}

function formatPnlCell(line: PnlLine, value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  if (line.pct) {
    const pct = Math.abs(value) <= 1 ? value * 100 : value;
    return `${pct.toFixed(1)}%`;
  }
  if (line.key && /(guests_day|guests_month|fte|_count)$/.test(line.key)) {
    return Math.round(value).toLocaleString('en-ID');
  }
  return formatIdr(value, true);
}

function getKpiAt(
  actual: (number | null)[] | undefined,
  forecast: (number | null)[] | undefined,
  idx: number,
): number | null {
  const a = actual?.[idx];
  if (a != null) return a;
  const f = forecast?.[idx];
  return f != null ? f : null;
}

export function PnlTableBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('pnl_table', config);

  const selectedMonthLabel = useAppSelector((s) => s.ui.selectedMonthLabel);
  const selectedMonthPeriod = useAppSelector((s) => s.ui.selectedMonthPeriod);

  const { data: overviewData } = useGetChartOverviewQuery('conservative');
  const overview = overviewData?.data;

  const monthIndex = useMemo(() => {
    if (!selectedMonthLabel || !overview?.labels) return -1;
    return overview.labels.indexOf(selectedMonthLabel);
  }, [selectedMonthLabel, overview?.labels]);

  const period = selectedMonthPeriod ?? '';
  const { data: pnlData, isLoading, isError } = useGetPnlDetailQuery(period, {
    skip: !period,
  });

  const summaryRow = useMemo(() => {
    if (monthIndex < 0 || !overview) return null;
    const rev = getKpiAt(overview.actual.revenue, overview.forecast.revenue, monthIndex);
    const ebit = getKpiAt(overview.actual.ebitda, overview.forecast.ebitda, monthIndex);
    const guests = getKpiAt(overview.actual.guests, overview.forecast.guests, monthIndex);
    const sc = getKpiAt(overview.actual.staff_cost, overview.forecast.staff_cost, monthIndex);
    const net = getKpiAt(overview.actual.net_income, overview.forecast.net_income, monthIndex);
    return { rev, ebit, guests, sc, net };
  }, [monthIndex, overview]);

  const breakdownRows = useMemo(() => {
    const scenarios = pnlData?.data?.scenarios;
    if (!scenarios) return [];

    const template =
      scenarios.conservative?.lines?.length
        ? scenarios.conservative.lines
        : scenarios.actual?.lines ?? [];

    const cols = ['actual', 'conservative', 'realistic', 'aspirational'] as const;

    return template.map((line) => {
      const values: Record<string, string> = {};
      for (const col of cols) {
        const scenarioLines = scenarios[col]?.lines ?? [];
        const match = scenarioLines.find((l) => l.key === line.key);
        values[col] = formatPnlCell(line, match?.value ?? null);
      }
      return { label: line.label ?? line.key ?? '—', values };
    });
  }, [pnlData]);

  return (
    <Box component="section" sx={{ maxWidth: 900, mx: 'auto', px: 3, pb: 6 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        {selectedMonthLabel
          ? `${selectedMonthLabel} — P&L Detail`
          : 'Select a month on the chart'}
      </Typography>

      <TableContainer component={Paper} elevation={0} sx={{ mb: 4, border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Month</TableCell>
              <TableCell>Revenue</TableCell>
              <TableCell>EBITDA</TableCell>
              <TableCell>Guests</TableCell>
              <TableCell>Staff Cost %</TableCell>
              <TableCell>Net Profit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {summaryRow && selectedMonthLabel ? (
              <TableRow>
                <TableCell>
                  <strong>{selectedMonthLabel}</strong>
                </TableCell>
                <TableCell>{formatIdr(summaryRow.rev)}</TableCell>
                <TableCell>{formatIdr(summaryRow.ebit, true)}</TableCell>
                <TableCell>
                  {summaryRow.guests != null
                    ? Math.round(summaryRow.guests).toLocaleString('en-ID')
                    : '—'}
                </TableCell>
                <TableCell>{staffCostPct(summaryRow.rev, summaryRow.sc)}</TableCell>
                <TableCell>{formatIdr(summaryRow.net, true)}</TableCell>
              </TableRow>
            ) : (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ color: 'text.secondary' }}>
                  Click a month bar above to view details
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        Monthly P&amp;L Breakdown
      </Typography>

      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : isError || !period ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
          P&amp;L detail loads when a month is selected
        </Typography>
      ) : (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Line Item</TableCell>
                <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>Actuals</TableCell>
                <TableCell>Conservative</TableCell>
                <TableCell>Realistic</TableCell>
                <TableCell>Aspirational</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {breakdownRows.length ? (
                breakdownRows.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell sx={{ color: 'primary.main', fontWeight: 600 }}>
                      {row.values.actual}
                    </TableCell>
                    <TableCell>{row.values.conservative}</TableCell>
                    <TableCell>{row.values.realistic}</TableCell>
                    <TableCell>{row.values.aspirational}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary' }}>
                    No P&amp;L lines for this period
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
