'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef, type GridValidRowModel } from '@mui/x-data-grid';
import { useGetReportsQuery, type ReportPeriod } from '@/store/apis/financial-api';

// ── Sheet data view (when config.sheet is provided) ────

interface SheetDataPayload {
  sheet: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  perPage: number;
  totalPages: number;
}

const PER_PAGE = 200;

function isLikelyFinancial(key: string, value: unknown): boolean {
  if (typeof value === 'number' && Math.abs(value) > 1000) return true;
  const k = key.toLowerCase();
  return /amount|total|sales|revenue|cost|price|balance|amount|sum|income|expense/i.test(k);
}

function SheetDataView({ sheet, title }: { sheet: string; title?: string }) {
  const [data, setData] = useState<SheetDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PER_PAGE });

  const fetchPage = useCallback((page: number) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ sheet, page: String(page + 1), perPage: String(PER_PAGE) });
    fetch(`/api/sheet-data?${params}`)
      .then((r) => r.json())
      .then((payload) => {
        if (payload.error) setError(payload.error);
        else setData(payload);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Request failed'))
      .finally(() => setLoading(false));
  }, [sheet]);

  useEffect(() => { fetchPage(paginationModel.page); }, [paginationModel.page, fetchPage]);

  const columns: GridColDef[] = useMemo(() => {
    if (!data) return [];
    return data.columns.map((col) => ({
      field: col,
      headerName: col,
      flex: 1,
      minWidth: 100,
      sortable: true,
      filterable: true,
      resizable: true,
      valueGetter: (_value: unknown, row: GridValidRowModel) => {
        const raw = row[col];
        if (isLikelyFinancial(col, raw) && typeof raw === 'number') return raw;
        return raw ?? '';
      },
      valueFormatter: (value: unknown) => {
        if (typeof value === 'number' && isLikelyFinancial(col, value)) {
          if (value >= 1_000_000_000) return `IDR ${(value / 1_000_000_000).toFixed(2)}B`;
          if (value >= 1_000_000) return `IDR ${(value / 1_000_000).toLocaleString('id-ID')}`;
          if (value >= 1_000) return `IDR ${(value / 1_000).toFixed(0)}K`;
          return value.toLocaleString('id-ID');
        }
        return value ?? '';
      },
    }));
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row, idx) => ({
      ...row,
      _rowIndex: (data.page - 1) * data.perPage + idx + 1,
    }));
  }, [data]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 140px)', minHeight: 400, mx: 'auto', px: 3, py: 1.5 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, flexShrink: 0 }}>
        {title ?? `${sheet} — Data`}
      </Typography>
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : data ? (
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row._rowIndex}
          loading={loading}
          rowCount={data.totalRows}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[PER_PAGE]}
          disableRowSelectionOnClick
          sx={{
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            '& .MuiDataGrid-cell': { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
            '& .MuiDataGrid-columnHeader': { fontWeight: 700 },
          }}
        />
      ) : null}
    </Box>
  );
}

// ── Z-Report rollup view (default, when no sheet config) ──

function formatIdr(value: number | bigint | string | null | undefined): string {
  if (value == null) return '—';
  const n = typeof value === 'bigint' ? Number(value) : Number(value);
  if (Number.isNaN(n)) return '—';
  return `IDR ${Math.round(n).toLocaleString('en-ID')}`;
}

function periodLabel(row: Record<string, unknown>, period: ReportPeriod): string {
  if (period === 'daily') return String(row.date ?? '—');
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

function ZReportRollupView() {
  const [period, setPeriod] = useState<ReportPeriod>('monthly');
  const { data, isLoading, isError } = useGetReportsQuery({ period });
  const metrics = (data?.data?.metrics ?? []) as Record<string, unknown>[];

  return (
    <Box component="section" sx={{   mx: 'auto', px: 3, py: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Z-Report Rollup
      </Typography>
      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', mb: 2 }}>
        <Tabs value={period} onChange={(_e, value: ReportPeriod) => setPeriod(value)} variant="scrollable" scrollButtons="auto">
          {PERIOD_TABS.map((tab) => <Tab key={tab.value} value={tab.value} label={tab.label} />)}
        </Tabs>
      </Paper>
      {isLoading ? <Typography color="text.secondary">Loading reports…</Typography> : null}
      {isError ? <Typography color="error">Failed to load reports.</Typography> : null}
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
                <TableRow><TableCell colSpan={6}><Typography variant="body2" color="text.secondary">No Z-report data for this period.</Typography></TableCell></TableRow>
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

// ── Main component — dispatches based on config ─────────

export function ReportsRollupBlock({ config }: { config: Record<string, unknown> }) {
  const sheet = config?.sheet as string | undefined;
  if (sheet) {
    return <SheetDataView sheet={sheet} title={config?.title as string | undefined} />;
  }
  return <ZReportRollupView />;
}
