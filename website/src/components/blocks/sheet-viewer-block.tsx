'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import type { GridColDef, GridValidRowModel } from '@mui/x-data-grid';
import { useGetSheetDataQuery } from '@/store/apis/sheet-data-api';

const DataGrid = dynamic(
  () => import('@mui/x-data-grid').then((m) => ({ default: m.DataGrid })),
  {
    ssr: false,
    loading: () => (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress size={24} />
      </Box>
    ),
  },
);

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

const PER_PAGE = 100;

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
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: PER_PAGE });
  const { data: payload, isLoading, error: queryError } = useGetSheetDataQuery(
    { sheet: sheet ?? '', page: paginationModel.page + 1, perPage: PER_PAGE },
    { skip: !sheet },
  );

  const columns: GridColDef[] = useMemo(() => {
    const sd = payload?.data;
    if (!sd) return [];
    return sd.columns.map((col) => ({
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
  }, [payload]);

  const rows = useMemo(() => {
    const sd = payload?.data;
    if (!sd) return [];
    return sd.rows.map((row, idx) => ({
      ...row,
      _rowIndex: (sd.page - 1) * sd.perPage + idx + 1,
    }));
  }, [payload]);

  const data = payload?.data;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 130px)', minHeight: 400, width: '100%' }}>
      {title ? (
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, flexShrink: 0 }}>
          {title}
        </Typography>
      ) : null}

      {!sheet ? (
        <Typography color="text.secondary">No sheet configured.</Typography>
      ) : isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
      ) : queryError ? (
        <Typography color="error">{String(queryError)}</Typography>
      ) : data ? (
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row._rowIndex}
          loading={isLoading}
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
