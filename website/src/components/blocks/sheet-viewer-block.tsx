'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { DataGrid, type GridColDef, type GridValidRowModel } from '@mui/x-data-grid';

interface SheetViewerConfig {
  sheet?: string;
  columns?: string[];
  title?: string;
}

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

function formatCellValue(key: string, value: unknown): string | number {
  if (value === '' || value === undefined || value === null) return '';
  if (typeof value === 'number') {
    if (isLikelyFinancial(key, value)) {
      if (value >= 1_000_000_000) return `IDR ${(value / 1_000_000_000).toFixed(2)}B`;
      if (value >= 1_000_000) return `IDR ${(value / 1_000_000).toLocaleString('id-ID')}`;
      if (value >= 1_000) return `IDR ${(value / 1_000).toFixed(0)}K`;
      return value.toLocaleString('id-ID');
    }
    return value.toLocaleString('id-ID');
  }
  return String(value);
}

export function SheetViewerBlock({ config }: { config: Record<string, unknown> }) {
  const { sheet, title } = config as SheetViewerConfig;
  const [data, setData] = useState<SheetDataPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PER_PAGE });

  const fetchPage = useCallback((page: number) => {
    if (!sheet) { setLoading(false); return; }
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

  useEffect(() => {
    if (sheet) fetchPage(paginationModel.page);
    else setLoading(false);
  }, [paginationModel.page, sheet, fetchPage]);

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
        if (isLikelyFinancial(col, raw) && typeof raw === 'number') {
          return raw; // keep numeric for sorting
        }
        return raw ?? '';
      },
      valueFormatter: (value: unknown) => {
        if (typeof value === 'number' && isLikelyFinancial(col, value)) {
          return formatCellValue(col, value);
        }
        return value ?? '';
      },
    }));
  }, [data]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.rows.map((row, idx) => ({
      id: (data.page - 1) * data.perPage + idx + 1,
      ...row,
    }));
  }, [data]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 130px)', minHeight: 400, width: '100%' }}>
      {title ? (
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, flexShrink: 0 }}>
          {title}
        </Typography>
      ) : null}

      {!sheet ? (
        <Typography color="text.secondary">No sheet configured.</Typography>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : data ? (
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowCount={data.totalRows}
          paginationMode="server"
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[PER_PAGE]}
          disableRowSelectionOnClick
          sx={{
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
