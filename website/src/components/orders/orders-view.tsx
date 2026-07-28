'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import InputAdornment from '@mui/material/InputAdornment';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import OutlinedInput from '@mui/material/OutlinedInput';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import VisibilityIcon from '@mui/icons-material/Visibility';

// ── Types ───────────────────────────────────────────

interface Order {
  id: string;
  customer: string;
  email: string;
  items: number;
  total: number; // IDR thousands
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  date: string; // ISO date
  paymentMethod: string;
}

type SortField = 'id' | 'customer' | 'total' | 'status' | 'date';
type SortDir = 'asc' | 'desc';

// ── Mock Data ───────────────────────────────────────

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const MOCK_ORDERS: Order[] = [
  { id: 'ORD-001', customer: 'James Wilson', email: 'james@example.com', items: 3, total: 1250, status: 'delivered', date: '2026-07-25', paymentMethod: 'Credit Card' },
  { id: 'ORD-002', customer: 'Sarah Chen', email: 'sarah@example.com', items: 1, total: 450, status: 'processing', date: '2026-07-26', paymentMethod: 'GoPay' },
  { id: 'ORD-003', customer: 'Michael Brown', email: 'michael@example.com', items: 5, total: 2100, status: 'pending', date: '2026-07-26', paymentMethod: 'Bank Transfer' },
  { id: 'ORD-004', customer: 'Emily Davis', email: 'emily@example.com', items: 2, total: 340, status: 'shipped', date: '2026-07-24', paymentMethod: 'Credit Card' },
  { id: 'ORD-005', customer: 'David Martinez', email: 'david@example.com', items: 7, total: 3200, status: 'cancelled', date: '2026-07-23', paymentMethod: 'PayPal' },
  { id: 'ORD-006', customer: 'Lisa Anderson', email: 'lisa@example.com', items: 2, total: 980, status: 'delivered', date: '2026-07-22', paymentMethod: 'GoPay' },
  { id: 'ORD-007', customer: 'Robert Taylor', email: 'robert@example.com', items: 1, total: 125, status: 'processing', date: '2026-07-26', paymentMethod: 'Bank Transfer' },
  { id: 'ORD-008', customer: 'Amanda White', email: 'amanda@example.com', items: 4, total: 720, status: 'pending', date: '2026-07-26', paymentMethod: 'Credit Card' },
  { id: 'ORD-009', customer: 'Thomas Lee', email: 'thomas@example.com', items: 2, total: 1100, status: 'shipped', date: '2026-07-25', paymentMethod: 'GoPay' },
  { id: 'ORD-010', customer: 'Jennifer Kim', email: 'jennifer@example.com', items: 1, total: 185, status: 'delivered', date: '2026-07-21', paymentMethod: 'PayPal' },
  { id: 'ORD-011', customer: 'Chris Patel', email: 'chris@example.com', items: 3, total: 1650, status: 'processing', date: '2026-07-26', paymentMethod: 'Bank Transfer' },
  { id: 'ORD-012', customer: 'Maria Garcia', email: 'maria@example.com', items: 2, total: 480, status: 'pending', date: '2026-07-26', paymentMethod: 'Credit Card' },
  { id: 'ORD-013', customer: 'Daniel Wong', email: 'daniel@example.com', items: 1, total: 360, status: 'delivered', date: '2026-07-20', paymentMethod: 'GoPay' },
  { id: 'ORD-014', customer: 'Sophie Turner', email: 'sophie@example.com', items: 6, total: 2800, status: 'cancelled', date: '2026-07-19', paymentMethod: 'PayPal' },
  { id: 'ORD-015', customer: 'Alex Johnson', email: 'alex@example.com', items: 2, total: 670, status: 'shipped', date: '2026-07-25', paymentMethod: 'Credit Card' },
  { id: 'ORD-016', customer: 'Nina Suzuki', email: 'nina@example.com', items: 4, total: 950, status: 'processing', date: '2026-07-26', paymentMethod: 'GoPay' },
  { id: 'ORD-017', customer: 'Omar Hassan', email: 'omar@example.com', items: 1, total: 210, status: 'pending', date: '2026-07-26', paymentMethod: 'Bank Transfer' },
  { id: 'ORD-018', customer: 'Rachel Green', email: 'rachel@example.com', items: 3, total: 1500, status: 'delivered', date: '2026-07-18', paymentMethod: 'Credit Card' },
  { id: 'ORD-019', customer: 'Kevin Brown', email: 'kevin@example.com', items: 2, total: 890, status: 'shipped', date: '2026-07-25', paymentMethod: 'GoPay' },
  { id: 'ORD-020', customer: 'Hannah Lee', email: 'hannah@example.com', items: 1, total: 550, status: 'pending', date: '2026-07-26', paymentMethod: 'PayPal' },
];

// ── Helpers ─────────────────────────────────────────

function statusColor(status: Order['status']): 'default' | 'info' | 'warning' | 'success' | 'error' {
  switch (status) {
    case 'pending': return 'default';
    case 'processing': return 'info';
    case 'shipped': return 'warning';
    case 'delivered': return 'success';
    case 'cancelled': return 'error';
  }
}

function formatPrice(idrThousands: number): string {
  return `Rp ${(idrThousands * 1000).toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Component ───────────────────────────────────────

export function OrdersView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    let list = [...MOCK_ORDERS];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (o) =>
          o.id.toLowerCase().includes(q) ||
          o.customer.toLowerCase().includes(q) ||
          o.email.toLowerCase().includes(q),
      );
    }

    if (statusFilter) {
      list = list.filter((o) => o.status === statusFilter);
    }

    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'id') return mul * a.id.localeCompare(b.id);
      if (sortField === 'customer') return mul * a.customer.localeCompare(b.customer);
      if (sortField === 'total') return mul * (a.total - b.total);
      if (sortField === 'date') return mul * (new Date(a.date).getTime() - new Date(b.date).getTime());
      if (sortField === 'status') return mul * a.status.localeCompare(b.status);
      return 0;
    });

    return list;
  }, [search, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const pendingCount = MOCK_ORDERS.filter((o) => o.status === 'pending').length;
  const processingCount = MOCK_ORDERS.filter((o) => o.status === 'processing').length;
  const totalRevenue = MOCK_ORDERS.filter((o) => o.status !== 'cancelled').reduce((s, o) => s + o.total, 0);

  return (
    <Box sx={{ mx: 'auto', px: 3, py: 3 }}>
      {/* Header */}
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Orders
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {MOCK_ORDERS.length} total orders · {pendingCount} pending · {processingCount} in progress
      </Typography>

      {/* KPI Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Chip label={`${MOCK_ORDERS.length} orders`} color="primary" variant="outlined" />
        <Chip label={`${pendingCount} pending`} color="default" variant="outlined" />
        <Chip label={`${processingCount} processing`} color="info" variant="outlined" />
        <Chip label={`Rp ${(totalRevenue / 1_000_000).toFixed(1)}M revenue`} color="success" variant="outlined" />
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} useFlexGap>
          <OutlinedInput
            placeholder="Search orders, customers, or email…"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            }
            sx={{ minWidth: 280, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="status-label">Status</InputLabel>
            <Select
              labelId="status-label"
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All statuses</MenuItem>
              {STATUSES.map((s) => (
                <MenuItem key={s} value={s} sx={{ textTransform: 'capitalize' }}>{s}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined" sx={{ overflowX: 'auto' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortField === 'id'} direction={sortField === 'id' ? sortDir : 'asc'} onClick={() => toggleSort('id')}>
                  Order ID
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'customer'} direction={sortField === 'customer' ? sortDir : 'asc'} onClick={() => toggleSort('customer')}>
                  Customer
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">Items</TableCell>
              <TableCell align="right">
                <TableSortLabel active={sortField === 'total'} direction={sortField === 'total' ? sortDir : 'asc'} onClick={() => toggleSort('total')}>
                  Total
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'status'} direction={sortField === 'status' ? sortDir : 'asc'} onClick={() => toggleSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'date'} direction={sortField === 'date' ? sortDir : 'asc'} onClick={() => toggleSort('date')}>
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell>Payment</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((order) => (
              <TableRow
                key={order.id}
                sx={{
                  '&:hover': { bgcolor: 'action.hover' },
                  '&:active': { bgcolor: 'action.selected' },
                  opacity: order.status === 'cancelled' ? 0.6 : 1,
                }}
              >
                <TableCell>
                  <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                    {order.id}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{order.customer}</Typography>
                  <Typography variant="caption" color="text.secondary">{order.email}</Typography>
                </TableCell>
                <TableCell align="right">{order.items}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>{formatPrice(order.total)}</TableCell>
                <TableCell>
                  <Chip label={order.status} size="small" color={statusColor(order.status)} variant="outlined" />
                </TableCell>
                <TableCell>
                  <Typography variant="body2">{formatDate(order.date)}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="caption">{order.paymentMethod}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Chip
                    icon={<VisibilityIcon fontSize="small" />}
                    label="View"
                    size="small"
                    variant="outlined"
                    clickable
                    onClick={() => alert(`View details for ${order.id} — coming soon`)}
                  />
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No orders match your search.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
