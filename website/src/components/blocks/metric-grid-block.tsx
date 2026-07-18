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
    may: 'IDR 2.24B',
    conservative: 'IDR 3.52B',
    realistic: 'IDR 3.75B',
    aspirational: 'IDR 5.45B',
  },
  {
    metric: 'Monthly EBITDA',
    may: '+IDR 166M',
    conservative: '+IDR 625M',
    realistic: '+IDR 697M',
    aspirational: 'IDR 1.29B',
    bold: true,
  },
  {
    metric: 'EBITDA Margin',
    may: '7.5%',
    conservative: '21.5%',
    realistic: '22.5%',
    aspirational: '28.6%',
  },
  {
    metric: 'Guests/Month',
    may: '4,817',
    conservative: '8,850',
    realistic: '9,180',
    aspirational: '10,110',
  },
  {
    metric: 'Avg Spend/Guest',
    may: '~IDR 544K',
    conservative: 'IDR 398K',
    realistic: 'IDR 409K',
    aspirational: 'IDR 539K',
  },
];

export function MetricGridBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('metric_grid', config);

  return (
    <Box component="section" sx={{   mx: 'auto', px: 3, py: 4 }}>
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
