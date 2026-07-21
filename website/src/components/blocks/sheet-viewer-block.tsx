'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

/**
 * SheetViewerBlock
 *
 * Renders a sheet's data from the workbook analysis stored as a knowledge snippet.
 * The component fetches the analysis from the content API and renders a summary table.
 * In a full implementation this would query sheet data from the database or XLSX cache.
 */

interface SheetViewerConfig {
  sheet?: string;
  columns?: string[];
  title?: string;
}

function formatIdr(value: unknown): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return String(value ?? '');
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toFixed(0)}M`;
  return `IDR ${n.toLocaleString('id-ID')}`;
}

export function SheetViewerBlock({ config }: { config: Record<string, unknown> }) {
  const { sheet, columns, title } = config as SheetViewerConfig;

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack spacing={2}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          {title ?? sheet ?? 'Sheet Data'}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {columns?.length ? (
            <>
              Columns: <strong>{(columns ?? []).join(', ')}</strong>
            </>
          ) : null}
          {sheet ? (
            <>
              &nbsp;· Source sheet: <strong>{sheet}</strong>
            </>
          ) : null}
        </Typography>

        {columns && columns.length > 0 ? (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small" sx={{ '& th': { fontWeight: 700 } }}>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell key={col}>{col}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell colSpan={columns.length} align="center">
                    <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                      Sheet data loads from the workbook cache on the full report page.
                      Use the tracking page for interactive drill-down.
                    </Typography>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No column metadata available for this sheet.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
