'use client';

import { useState } from 'react';
import Tooltip from '@mui/material/Tooltip';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Divider from '@mui/material/Divider';
import Snackbar from '@mui/material/Snackbar';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import BuildIcon from '@mui/icons-material/Build';
import {
  useListTenantsQuery,
  useDeleteTenantMutation,
} from '@/store/apis/tenant-api';
import { getTemplate } from '@/domain/tenant/template-catalog';
import { TenantWizard } from '@/components/ops-admin/tenant-wizard';

const STATUS_COLORS: Record<string, 'info' | 'warning' | 'success' | 'error'> = {
  draft: 'info',
  deploying: 'warning',
  live: 'success',
  error: 'error',
};

export function TenantDashboard() {
  const { data, isLoading, isError, refetch } = useListTenantsQuery();
  const [deleteTenant, { isLoading: isDeleting }] = useDeleteTenantMutation();
  const [deleting, setDeleting] = useState<string | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ slug: string; el: HTMLElement } | null>(null);
  const [snackbar, setSnackbar] = useState<{ message: string; severity: 'success' | 'error' } | null>(null);

  // Delete confirmation dialog state
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const tenants = data?.data?.tenants ?? [];

  const handleMenuOpen = (slug: string, el: HTMLElement) => setMenuAnchor({ slug, el });
  const handleMenuClose = () => setMenuAnchor(null);

  const handleSeed = async (slug: string) => {
    handleMenuClose();
    try {
      const res = await fetch(`/api/admin/tenants/${slug}/seed`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSnackbar({ message: 'Tenant seeded successfully', severity: 'success' });
      } else {
        setSnackbar({ message: data.error || 'Failed to seed tenant', severity: 'error' });
      }
    } catch {
      setSnackbar({ message: 'Failed to seed tenant', severity: 'error' });
    }
  };

  const handleMigrate = async (slug: string) => {
    handleMenuClose();
    try {
      const res = await fetch(`/api/admin/tenants/${slug}/migrate`, { method: 'POST' });
      const data = await res.json();
      if (data.ok) {
        setSnackbar({ message: 'Tenant migration completed', severity: 'success' });
      } else {
        setSnackbar({ message: data.error || 'Failed to migrate tenant', severity: 'error' });
      }
    } catch {
      setSnackbar({ message: 'Failed to migrate tenant', severity: 'error' });
    }
  };

  const handleDelete = async (slug: string) => {
    handleMenuClose();
    setConfirmDelete(null);
    setDeleting(slug);
    try {
      await deleteTenant(slug).unwrap();
      setSnackbar({ message: 'Tenant deleted successfully', severity: 'success' });
    } catch (err: unknown) {
      const msg =
        err && typeof err === 'object' && 'data' in err
          ? String((err as { data: { error?: string } }).data?.error ?? 'Unknown error')
          : 'Failed to delete tenant';
      setSnackbar({ message: msg, severity: 'error' });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <Stack spacing={3}>
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              Tenant Applications
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage registered tenant applications. Create new tenants, monitor deployment status, and configure settings.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton onClick={() => refetch()} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            <TenantWizard />
          </Stack>
        </Stack>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : isError ? (
          <Alert severity="error">Failed to load tenants. The tenants table may need to be migrated — run seed or migrate first.</Alert>
        ) : tenants.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
              No tenants registered yet. Create your first tenant application to get started.
            </Typography>
            <TenantWizard />
          </Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Tenant</TableCell>
                <TableCell>Template</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>URL</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {tenants.map((t) => {
                const tpl = getTemplate(t.template);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {t.displayName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t.slug}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={tpl.label} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={t.status}
                        size="small"
                        color={STATUS_COLORS[t.status] ?? 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {t.appUrl ? (
                        <Button
                          size="small"
                          variant="text"
                          href={t.appUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {t.appUrl.replace('https://', '')}
                        </Button>
                      ) : t.status === 'live' ? (
                        <Button
                          size="small"
                          variant="text"
                          href={`https://${t.slug}.vercel.app`}
                          target="_blank"
                          rel="noopener noreferrer"
                          endIcon={<OpenInNewIcon fontSize="small" />}
                          sx={{ fontSize: '0.75rem' }}
                        >
                          {t.slug}.vercel.app
                        </Button>
                      ) : (
                        <Typography variant="caption" color="text.disabled">
                          {t.slug}.vercel.app
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(t.createdAt).toLocaleDateString()}
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <IconButton
                        size="small"
                        onClick={(e) => handleMenuOpen(t.slug, e.currentTarget)}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                      <Menu
                        anchorEl={menuAnchor?.slug === t.slug ? menuAnchor.el : null}
                        open={menuAnchor?.slug === t.slug}
                        onClose={handleMenuClose}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                      >
                        <MenuItem onClick={() => void handleSeed(t.slug)}>
                          <ListItemIcon><PlayArrowIcon fontSize="small" /></ListItemIcon>
                          <ListItemText>Seed</ListItemText>
                        </MenuItem>
                        <MenuItem onClick={() => void handleMigrate(t.slug)}>
                          <ListItemIcon><BuildIcon fontSize="small" /></ListItemIcon>
                          <ListItemText>Migrate</ListItemText>
                        </MenuItem>
                        <Divider />
                        <MenuItem
                          onClick={() => { handleMenuClose(); setConfirmDelete(t.slug); }}
                          disabled={isDeleting && deleting === t.slug}
                        >
                          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
                          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
                        </MenuItem>
                      </Menu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      >
        <DialogTitle>Delete Tenant?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to permanently delete tenant <strong>{confirmDelete}</strong>?
            This action cannot be undone. All data associated with this tenant will be removed.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
            color="error"
            variant="contained"
            disabled={isDeleting && deleting === confirmDelete}
          >
            {isDeleting && deleting === confirmDelete ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Feedback Snackbar */}
      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={4000}
        onClose={() => setSnackbar(null)}
        message={snackbar?.message}
      />
    </Stack>
  );
}
