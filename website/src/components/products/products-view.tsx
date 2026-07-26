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
import EditIcon from '@mui/icons-material/Edit';
import SearchIcon from '@mui/icons-material/Search';

// ── Types ───────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number; // IDR thousands
  stock: number;
  status: 'active' | 'draft' | 'discontinued';
  image?: string;
}

type SortField = 'name' | 'price' | 'stock' | 'category';
type SortDir = 'asc' | 'desc';

// ── Mock Data ───────────────────────────────────────

const CATEGORIES = ['Electronics', 'Clothing', 'Home & Garden', 'Sports', 'Beauty', 'Books'];

const MOCK_PRODUCTS: Product[] = [
  { id: 'P-1001', name: 'Wireless Bluetooth Headphones', sku: 'WH-2000', category: 'Electronics', price: 450, stock: 234, status: 'active' },
  { id: 'P-1002', name: 'Organic Cotton T-Shirt', sku: 'CT-100', category: 'Clothing', price: 89, stock: 1200, status: 'active' },
  { id: 'P-1003', name: 'Stainless Steel Water Bottle', sku: 'SS-050', category: 'Home & Garden', price: 125, stock: 560, status: 'active' },
  { id: 'P-1004', name: 'Yoga Mat Premium', sku: 'YM-300', category: 'Sports', price: 250, stock: 340, status: 'active' },
  { id: 'P-1005', name: 'Vitamin C Serum 30ml', sku: 'VC-030', category: 'Beauty', price: 180, stock: 0, status: 'discontinued' },
  { id: 'P-1006', name: 'Smart Watch Pro', sku: 'SW-500', category: 'Electronics', price: 1250, stock: 89, status: 'active' },
  { id: 'P-1007', name: 'Denim Jacket Classic', sku: 'DJ-200', category: 'Clothing', price: 650, stock: 45, status: 'draft' },
  { id: 'P-1008', name: 'Indoor Plant Set (3-Pack)', sku: 'PL-003', category: 'Home & Garden', price: 210, stock: 120, status: 'active' },
  { id: 'P-1009', name: 'Resistance Bands Set', sku: 'RB-005', category: 'Sports', price: 95, stock: 890, status: 'active' },
  { id: 'P-1010', name: 'Hydrating Face Mask Pack', sku: 'FM-010', category: 'Beauty', price: 65, stock: 1500, status: 'active' },
  { id: 'P-1011', name: 'USB-C Charging Hub', sku: 'CH-007', category: 'Electronics', price: 320, stock: 200, status: 'active' },
  { id: 'P-1012', name: 'Linen Summer Dress', sku: 'LD-400', category: 'Clothing', price: 480, stock: 0, status: 'draft' },
  { id: 'P-1013', name: 'Ceramic Coffee Mug Set', sku: 'CM-004', category: 'Home & Garden', price: 150, stock: 430, status: 'active' },
  { id: 'P-1014', name: 'Running Shoes Ultra', sku: 'RS-100', category: 'Sports', price: 890, stock: 67, status: 'active' },
  { id: 'P-1015', name: 'The Art of Leadership', sku: 'BK-021', category: 'Books', price: 185, stock: 320, status: 'active' },
  { id: 'P-1016', name: 'Portable Bluetooth Speaker', sku: 'BS-300', category: 'Electronics', price: 550, stock: 155, status: 'active' },
  { id: 'P-1017', name: 'Cashmere Scarf', sku: 'CS-100', category: 'Clothing', price: 360, stock: 78, status: 'active' },
  { id: 'P-1018', name: 'Bamboo Cutting Board', sku: 'BC-020', category: 'Home & Garden', price: 110, stock: 620, status: 'discontinued' },
  { id: 'P-1019', name: 'Zero to One', sku: 'BK-007', category: 'Books', price: 145, stock: 500, status: 'active' },
  { id: 'P-1020', name: 'Adjustable Dumbbell Set', sku: 'AD-050', category: 'Sports', price: 2400, stock: 25, status: 'active' },
];

// ── Helpers ─────────────────────────────────────────

function statusColor(status: Product['status']): 'success' | 'default' | 'error' {
  return status === 'active' ? 'success' : status === 'draft' ? 'default' : 'error';
}

function formatPrice(idrThousands: number): string {
  return `Rp ${(idrThousands * 1000).toLocaleString('id-ID')}`;
}

// ── Component ───────────────────────────────────────

export function ProductsView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const filtered = useMemo(() => {
    let list = [...MOCK_PRODUCTS];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q),
      );
    }

    if (category) {
      list = list.filter((p) => p.category === category);
    }

    list.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortField === 'name') return mul * a.name.localeCompare(b.name);
      if (sortField === 'category') return mul * a.category.localeCompare(b.category);
      if (sortField === 'price') return mul * (a.price - b.price);
      if (sortField === 'stock') return mul * (a.stock - b.stock);
      return 0;
    });

    return list;
  }, [search, category, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const activeCount = MOCK_PRODUCTS.filter((p) => p.status === 'active').length;
  const lowStockCount = MOCK_PRODUCTS.filter((p) => p.stock > 0 && p.stock < 100).length;
  const totalValue = MOCK_PRODUCTS.reduce((sum, p) => sum + p.price * p.stock, 0);

  return (
    <Box sx={{ mx: 'auto', px: 3, py: 3 }}>
      {/* Header */}
      <Stack direction="row" sx={{ mb: 1, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800 }}>
          Products
        </Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {MOCK_PRODUCTS.length} total products · {activeCount} active · {lowStockCount} low stock
      </Typography>

      {/* KPI Chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
        <Chip label={`${MOCK_PRODUCTS.length} products`} color="primary" variant="outlined" />
        <Chip label={`${activeCount} active`} color="success" variant="outlined" />
        <Chip label={`${lowStockCount} low stock`} color="warning" variant="outlined" />
        <Chip label={`Rp ${(totalValue / 1_000_000).toFixed(1)}M inventory value`} variant="outlined" />
      </Stack>

      {/* Filters */}
      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }} useFlexGap>
          <OutlinedInput
            placeholder="Search products or SKU…"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            }
            sx={{ minWidth: 260, flex: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel id="cat-label">Category</InputLabel>
            <Select
              labelId="cat-label"
              label="Category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <MenuItem value="">All categories</MenuItem>
              {CATEGORIES.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>
                <TableSortLabel active={sortField === 'name'} direction={sortField === 'name' ? sortDir : 'asc'} onClick={() => toggleSort('name')}>
                  Product
                </TableSortLabel>
              </TableCell>
              <TableCell>SKU</TableCell>
              <TableCell>
                <TableSortLabel active={sortField === 'category'} direction={sortField === 'category' ? sortDir : 'asc'} onClick={() => toggleSort('category')}>
                  Category
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel active={sortField === 'price'} direction={sortField === 'price' ? sortDir : 'asc'} onClick={() => toggleSort('price')}>
                  Price
                </TableSortLabel>
              </TableCell>
              <TableCell align="right">
                <TableSortLabel active={sortField === 'stock'} direction={sortField === 'stock' ? sortDir : 'asc'} onClick={() => toggleSort('stock')}>
                  Stock
                </TableSortLabel>
              </TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((product) => (
              <TableRow
                key={product.id}
                sx={{
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
                  opacity: product.status === 'discontinued' ? 0.6 : 1,
                }}
              >
                <TableCell sx={{ fontWeight: 600 }}>{product.name}</TableCell>
                <TableCell>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                    {product.sku}
                  </Typography>
                </TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell align="right">{formatPrice(product.price)}</TableCell>
                <TableCell align="right">
                  <Typography
                    variant="body2"
                    sx={{
                      color: product.stock === 0 ? 'error.main' : product.stock < 100 ? 'warning.main' : 'inherit',
                      fontWeight: product.stock < 100 ? 700 : 400,
                    }}
                  >
                    {product.stock === 0 ? 'Out of stock' : product.stock.toLocaleString()}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip label={product.status} size="small" color={statusColor(product.status)} variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <IconButton size="small" aria-label={`Edit ${product.name}`}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No products match your search.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
