'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { useGetReportsQuery, type ReportPeriod } from '@/store/apis/financial-api';

function formatIdr(value: number | bigint | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (Number.isNaN(n)) return '—';
  return `IDR ${Math.round(n).toLocaleString('en-ID')}`;
}

function periodLabel(
  row: Record<string, unknown>,
  period: ReportPeriod,
): string {
  if (period === 'daily') {
    return String(row.date ?? '—');
  }
  if (period === 'weekly') {
    const start = row.period_start;
    if (start instanceof Date) return start.toISOString().slice(0, 10);
    return String(start ?? '—').slice(0, 10);
  }
  return String(row.month ?? '—');
}

const PERIOD_TABS: { value: ReportPeriod; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

export function ReportsRollupBlock() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const { data, isLoading, isError } = useGetReportsQuery({ period });

  const metrics = (data?.data?.metrics ?? []) as Record<string, unknown>[];

  return (
    <Box component="section" sx={{ maxWidth: 1100, mx: 'auto', px: 3, py: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Z-Report Rollup
      </Typography>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs
          value={period}
          onChange={(_e, value: ReportPeriod) => setPeriod(value)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {PERIOD_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {isLoading ? (
        <Typography color="text.secondary">Loading reports…</Typography>
      ) : null}
      {isError ? (
        <Typography color="error">Failed to load reports.</Typography>
      ) : null}

      {!isLoading && !isError ? (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', overflow: 'auto' }}>
          <Table size="small" data-testid="reports-rollup-table">
            <TableHead>
              <TableRow>
                <TableCell>Period</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">Guests</TableCell>
                <TableCell align="right">Avg Spend</TableCell>
                <TableCell align="right">GoFood</TableCell>
                <TableCell align="right">Dine-In</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography variant="body2" color="text.secondary">
                      No Z-report data for this period.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                metrics.map((row, index) => (
                  <TableRow key={`${periodLabel(row, period)}-${index}`}>
                    <TableCell>{periodLabel(row, period)}</TableCell>
                    <TableCell align="right">{formatIdr(row.revenue as number)}</TableCell>
                    <TableCell align="right">{String(row.guests_count ?? '—')}</TableCell>
                    <TableCell align="right">{formatIdr(row.avg_spend as number)}</TableCell>
                    <TableCell align="right">{formatIdr(row.gofood_revenue as number)}</TableCell>
                    <TableCell align="right">{formatIdr(row.direct_orders as number)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Paper>
      ) : null}
    </Box>
  );
}
