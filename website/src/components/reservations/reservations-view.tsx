'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import FormControl from '@mui/material/FormControl';
import IconButton from '@mui/material/IconButton';
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
import EventSeatIcon from '@mui/icons-material/EventSeat';
import SearchIcon from '@mui/icons-material/Search';
import EditIcon from '@mui/icons-material/Edit';

// ── Types ───────────────────────────────────────────

interface Reservation {
  id: string;
  guestName: string;
  phone: string;
  date: string;
  time: string;
  partySize: number;
  tableNumber: string;
  status: 'confirmed' | 'pending' | 'seated' | 'completed' | 'cancelled';
  notes: string;
}

type SortKey = 'date' | 'guestName' | 'partySize' | 'status' | 'time';

const MOCK_RESERVATIONS: Reservation[] = [
  { id: 'R001', guestName: 'John Smith', phone: '+62 812-3456-7890', date: '2026-07-26', time: '18:00', partySize: 4, tableNumber: 'T5', status: 'confirmed', notes: 'Anniversary dinner' },
  { id: 'R002', guestName: 'Maria Garcia', phone: '+62 813-9876-5432', date: '2026-07-26', time: '19:30', partySize: 2, tableNumber: 'T3', status: 'confirmed', notes: 'Window seat preferred' },
  { id: 'R003', guestName: 'David Chen', phone: '+62 821-4567-8901', date: '2026-07-26', time: '20:00', partySize: 6, tableNumber: 'T8', status: 'pending', notes: 'Birthday celebration' },
  { id: 'R004', guestName: 'Sarah Wilson', phone: '+62 877-2345-6789', date: '2026-07-26', time: '17:30', partySize: 3, tableNumber: 'T4', status: 'seated', notes: '' },
  { id: 'R005', guestName: 'Alex Johnson', phone: '+62 896-7890-1234', date: '2026-07-26', time: '21:00', partySize: 8, tableNumber: 'VIP1', status: 'confirmed', notes: 'VIP - well-done steaks' },
  { id: 'R006', guestName: 'Lisa Brown', phone: '+62 815-6789-0123', date: '2026-07-27', time: '18:30', partySize: 2, tableNumber: 'T2', status: 'confirmed', notes: 'Honeymoon couple' },
  { id: 'R007', guestName: 'Michael Lee', phone: '+62 818-9012-3456', date: '2026-07-27', time: '19:00', partySize: 5, tableNumber: 'T7', status: 'pending', notes: 'Business dinner' },
  { id: 'R008', guestName: 'Emily Davis', phone: '+62 823-4567-8901', date: '2026-07-27', time: '20:30', partySize: 4, tableNumber: 'T6', status: 'confirmed', notes: '' },
  { id: 'R009', guestName: 'James Wilson', phone: '+62 878-9012-3456', date: '2026-07-25', time: '19:00', partySize: 3, tableNumber: 'T4', status: 'completed', notes: 'Regular customer' },
  { id: 'R010', guestName: 'Anna Taylor', phone: '+62 834-5678-9012', date: '2026-07-25', time: '18:00', partySize: 2, tableNumber: 'T1', status: 'cancelled', notes: 'Cancelled - emergency' },
  { id: 'R011', guestName: 'Robert Kim', phone: '+62 890-1234-5678', date: '2026-07-28', time: '18:00', partySize: 4, tableNumber: 'T5', status: 'confirmed', notes: '' },
  { id: 'R012', guestName: 'Jessica Martinez', phone: '+62 845-6789-0123', date: '2026-07-28', time: '19:30', partySize: 6, tableNumber: 'T8', status: 'pending', notes: 'Allergy: nuts' },
];

const STATUS_COLORS: Record<string, 'success' | 'warning' | 'info' | 'default' | 'error'> = {
  confirmed: 'success',
  pending: 'warning',
  seated: 'info',
  completed: 'default',
  cancelled: 'error',
};

export function ReservationsView() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const filtered = useMemo(() => {
    let items = MOCK_RESERVATIONS;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(
        (r) =>
          r.guestName.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.phone.includes(q),
      );
    }
    if (statusFilter !== 'All') {
      items = items.filter((r) => r.status === statusFilter);
    }
    return items;
  }, [search, statusFilter]);

  const sorted = useMemo(() => {
    const items = [...filtered];
    items.sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <EventSeatIcon color="primary" sx={{ fontSize: 32 }} />
        <Box>
          <Typography variant="h4" fontWeight={700}>
            Reservations
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {MOCK_RESERVATIONS.length} total reservations · {MOCK_RESERVATIONS.filter((r) => r.status === 'confirmed').length} confirmed
          </Typography>
        </Box>
      </Stack>

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <FormControl size="small" sx={{ minWidth: 240 }}>
            <OutlinedInput
              placeholder="Search by name, ID, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              startAdornment={
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              }
            />
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              value={statusFilter}
              label="Status"
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="All">All Statuses</MenuItem>
              <MenuItem value="confirmed">Confirmed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="seated">Seated</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortKey === 'guestName'} direction={sortKey === 'guestName' ? sortDir : 'asc'} onClick={() => toggleSort('guestName')}>
                  Guest
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'date'} direction={sortKey === 'date' ? sortDir : 'asc'} onClick={() => toggleSort('date')}>
                  Date
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'time'} direction={sortKey === 'time' ? sortDir : 'asc'} onClick={() => toggleSort('time')}>
                  Time
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'partySize'} direction={sortKey === 'partySize' ? sortDir : 'asc'} onClick={() => toggleSort('partySize')}>
                  Party
                </TableSortLabel>
              </TableCell>
              <TableCell>Table</TableCell>
              <TableCell>
                <TableSortLabel active={sortKey === 'status'} direction={sortKey === 'status' ? sortDir : 'asc'} onClick={() => toggleSort('status')}>
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell>Notes</TableCell>
              <TableCell align="right">Action</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>
                  <Typography variant="body2" fontWeight={600}>{r.guestName}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.phone}</Typography>
                </TableCell>
                <TableCell>{r.date}</TableCell>
                <TableCell>{r.time}</TableCell>
                <TableCell>{r.partySize} pax</TableCell>
                <TableCell>{r.tableNumber}</TableCell>
                <TableCell>
                  <Chip label={r.status} size="small" color={STATUS_COLORS[r.status] || 'default'} />
                </TableCell>
                <TableCell>
                  <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 150, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.notes || '—'}
                  </Typography>
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" disabled>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
                    No reservations found
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
