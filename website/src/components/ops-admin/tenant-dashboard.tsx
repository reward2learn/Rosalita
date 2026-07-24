'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
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

  const tenants = data?.data?.tenants ?? [];

  const handleDelete = async (slug: string) => {
    setDeleting(slug);
    await deleteTenant(slug).unwrap();
    setDeleting(null);
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
                      <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                        <Tooltip title="Delete tenant">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={isDeleting && deleting === t.slug}
                            onClick={() => void handleDelete(t.slug)}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Paper>
    </Stack>
  );
}
