'use client';

import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import { parseBlockConfig } from '@/lib/schemas/block-config';

const TARGET_ROWS = [
  {
    metric: 'Monthly Revenue',
    may: 'IDR 411M',
    conservative: 'IDR 615M',
    realistic: 'IDR 699M',
    aspirational: 'IDR 819M+',
  },
  {
    metric: 'Monthly EBITDA',
    may: '+IDR 434K',
    conservative: '+IDR 101M',
    realistic: 'IDR 150-200M',
    aspirational: 'IDR 298M',
    bold: true,
  },
  {
    metric: 'EBITDA Margin',
    may: '0.1%',
    conservative: '16.5%',
    realistic: '~25%',
    aspirational: '~32%',
  },
  {
    metric: 'Guests/Day',
    may: '56',
    conservative: '82',
    realistic: '88-100',
    aspirational: '100+',
  },
  {
    metric: 'Avg Spend/Guest',
    may: '~IDR 220K',
    conservative: 'IDR 250K',
    realistic: 'IDR 265K',
    aspirational: 'IDR 280K+',
  },
];

export function MetricGridBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('metric_grid', config);

  return (
    <Box component="section" sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        12-Month Target
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', mb: 3 }}
      >
        From barely breaking even to industry-leading margins.
      </Typography>
      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid', borderColor: 'divider' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              <TableCell>May 2026</TableCell>
              <TableCell>Conservative</TableCell>
              <TableCell>Realistic</TableCell>
              <TableCell>Aspirational</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {TARGET_ROWS.map((row) => (
              <TableRow key={row.metric}>
                <TableCell sx={{ fontWeight: row.bold ? 700 : 400 }}>
                  {row.metric}
                </TableCell>
                <TableCell sx={{ fontWeight: row.bold ? 700 : 400 }}>{row.may}</TableCell>
                <TableCell sx={{ fontWeight: row.bold ? 700 : 400 }}>{row.conservative}</TableCell>
                <TableCell sx={{ fontWeight: row.bold ? 700 : 400 }}>{row.realistic}</TableCell>
                <TableCell sx={{ fontWeight: row.bold ? 700 : 400 }}>{row.aspirational}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
