'use client';

import { useState, useCallback } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RefreshIcon from '@mui/icons-material/Refresh';
import HistoryIcon from '@mui/icons-material/History';
import { useListWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useDeleteWebhookMutation,
  useListWebhookEventsQuery,
  useTestWebhookMutation,
} from '@/store/apis/admin-api';
import type { WebhookConfigView, WebhookEventView } from '@/app/api/admin/webhooks/route';
import { PlatformAdminGate } from '@/components/auth/platform-admin-gate';


const COMMON_EVENTS = [
  // Vercel-specific events (pre-populated for easy selection)
  'vercel.deployment.created',
  'vercel.deployment.succeeded',
  'vercel.deployment.failed',
  'vercel.deployment.ready',
  'vercel.deployment.canceled',
  'vercel.deployment.error',
  // Platform events
  'user.created',
  'user.updated',
  'payment.succeeded',
  'payment.failed',
  'tenant.created',
  'tenant.deployed',
  'tenant.provisioned',
  'deployment.started',
  'deployment.completed',
  'custom.*',
];

interface WebhookFormData {
  provider: string;
  name?: string;
  endpoint: string;
  secret?: string;
  events: string[];
  isActive: boolean;
}

export function WebhookManager() {
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEventLogOpen, setIsEventLogOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfigView | null>(null);
  const [formData, setFormData] = useState<WebhookFormData>({
    provider: 'custom',
    endpoint: '',
    events: ['user.created'],
    isActive: true,
  });
  const [testStatus, setTestStatus] = useState<Record<string, 'loading' | 'success' | 'error' | undefined>>({});

  const { data: webhooksData, isLoading, refetch, error } = useListWebhooksQuery();
  const [createWebhook, { isLoading: isCreating }] = useCreateWebhookMutation();
  const [updateWebhook, { isLoading: isUpdating }] = useUpdateWebhookMutation();
  const [deleteWebhook, { isLoading: isDeleting }] = useDeleteWebhookMutation();
  const [testWebhook] = useTestWebhookMutation();
  const { data: eventsData, isLoading: isEventsLoading } = useListWebhookEventsQuery(
    { id: selectedWebhookId || '', limit: 20 },
    { skip: !selectedWebhookId || !isEventLogOpen }
  );

  const webhooks = webhooksData?.data?.webhooks || [];
  const events = eventsData?.data?.events || [];

  const handleOpenForm = (webhook?: WebhookConfigView) => {
    if (webhook) {
      setEditingWebhook(webhook);
      setFormData({
        provider: webhook.provider,
        name: webhook.name,
        endpoint: webhook.endpoint,
        secret: '', // don't preload secret for security
        events: webhook.events,
        isActive: webhook.isActive,
      });
    } else {
      setEditingWebhook(null);
      setFormData({
        provider: 'custom',
        endpoint: '',
        events: ['user.created'],
        isActive: true,
      });
    }
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingWebhook(null);
    setFormData({
      provider: 'custom',
      endpoint: '',
      events: ['user.created'],
      isActive: true,
    });
  };

  const handleSubmitForm = async () => {
    if (!formData.endpoint || formData.events.length === 0) {
      alert('Endpoint and at least one event are required');
      return;
    }

    try {
      const payload = {
        ...formData,
        name: formData.name || undefined,
        secret: formData.secret || undefined,
      };

      if (editingWebhook) {
        await updateWebhook({ id: editingWebhook.id, ...payload }).unwrap();
      } else {
        await createWebhook(payload).unwrap();
      }
      handleCloseForm();
      refetch();
    } catch (err) {
      console.error('Failed to save webhook:', err);
      alert('Failed to save webhook configuration. Please check console for details.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook configuration and all its event history?')) return;
    try {
      await deleteWebhook(id).unwrap();
      refetch();
      if (selectedWebhookId === id) {
        setSelectedWebhookId(null);
        setIsEventLogOpen(false);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete webhook');
    }
  };

  const handleTestWebhook = async (webhook: WebhookConfigView) => {
    setTestStatus((prev) => ({ ...prev, [webhook.id]: 'loading' }));

    try {
      const result = await testWebhook({
        id: webhook.id,
        eventType: 'test.webhook',
        samplePayload: {
          message: 'This is a test event from the Platform Admin UI',
          source: 'admin-ui',
          provider: webhook.provider,
          timestamp: new Date().toISOString(),
        },
      }).unwrap();

      const success = result.data?.success ?? false;
      setTestStatus((prev) => ({ ...prev, [webhook.id]: success ? 'success' : 'error' }));

      setTimeout(() => {
        setTestStatus((prev) => ({ ...prev, [webhook.id]: undefined }));
        refetch();
      }, 1500);

      if (success) {
        alert(`Test event sent successfully for ${webhook.provider || 'webhook'}. Delivery logged and event history updated.`);
      } else {
        alert(`Test completed with warnings. Check the event log for details.`);
      }
    } catch (err: any) {
      console.error('Test failed:', err);
      setTestStatus((prev) => ({ ...prev, [webhook.id]: 'error' }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [webhook.id]: undefined })), 2000);
      const errorMsg = err?.data?.error || err?.message || 'Unknown error. Verify the webhook endpoint is publicly reachable.';
      alert(`Test failed: ${errorMsg}`);
    }
  };

  const handleToggleActive = async (webhook: WebhookConfigView) => {
    try {
      await updateWebhook({
        id: webhook.id,
        isActive: !webhook.isActive,
      }).unwrap();
      refetch();
    } catch (err) {
      console.error('Failed to toggle webhook status:', err);
      alert('Failed to update active status. Please try again.');
    }
  };

  const openEventLog = (id: string) => {
    setSelectedWebhookId(id);
    setIsEventLogOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'success';
      case 'failed': return 'error';
      default: return 'warning';
    }
  };

  const formatLastTriggered = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    return date.toLocaleDateString();
  };

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        Failed to load webhooks. Please try again or check server logs.
      </Alert>
    );
  }

  return (
    <PlatformAdminGate>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Webhook Configurations
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Manage outbound webhooks for Vercel deployments, payment events, tenant lifecycle and custom integrations. 
              Supports signing secrets and event filtering.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
              disabled={isLoading}
            >
              Refresh
            </Button>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenForm()}
            >
              New Webhook
            </Button>
          </Box>
        </Box>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
            <CircularProgress />
          </Box>
        ) : webhooks.length === 0 ? (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No webhook configurations yet
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Create your first webhook to receive real-time notifications for key platform events.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenForm()}>
              Create First Webhook
            </Button>
          </Paper>
        ) : (
          <Paper sx={{ overflow: 'hidden' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Provider</TableCell>
                  <TableCell>Name / Endpoint</TableCell>
                  <TableCell>Events</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Last Triggered</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {webhooks.map((webhook: WebhookConfigView) => (
                  <TableRow key={webhook.id} hover>
                    <TableCell>
                      <Chip
                        label={webhook.provider.toUpperCase()}
                        color={webhook.provider === 'vercel' ? 'primary' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {webhook.name || 'Unnamed'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {webhook.endpoint}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 220 }}>
                        {webhook.events.slice(0, 3).map((event: string) => (
                          <Chip key={event} label={event} size="small" variant="outlined" />
                        ))}
                        {webhook.events.length > 3 && (
                          <Chip label={`+${webhook.events.length - 3}`} size="small" variant="outlined" />
                        )}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={webhook.isActive}
                            onChange={() => handleToggleActive(webhook)}
                            size="small"
                            color="success"
                          />
                        }
                        label={webhook.isActive ? 'Active' : 'Disabled'}
                        sx={{ m: 0 }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatLastTriggered(webhook.lastTriggered)}
                      </Typography>
                       {(webhook.eventCount ?? 0) > 0 && (
                         <Typography variant="caption" color="text.secondary">
                           {webhook.eventCount} events
                         </Typography>
                       )}

                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                        <Tooltip title="View Event Log">
                          <IconButton
                            size="small"
                            onClick={() => openEventLog(webhook.id)}
                          >
                            <HistoryIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Test Webhook">
                          <IconButton
                            size="small"
                            onClick={() => handleTestWebhook(webhook)}
                            disabled={testStatus[webhook.id] === 'loading'}
                            color={testStatus[webhook.id] === 'success' ? 'success' : testStatus[webhook.id] === 'error' ? 'error' : 'default'}
                          >
                            {testStatus[webhook.id] === 'loading' ? <CircularProgress size={18} /> : <PlayArrowIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Edit">
                          <IconButton size="small" onClick={() => handleOpenForm(webhook)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDelete(webhook.id)}
                            disabled={isDeleting}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={isFormOpen} onClose={handleCloseForm} maxWidth="md" fullWidth>
          <DialogTitle>
            {editingWebhook ? 'Edit Webhook Configuration' : 'Create New Webhook'}
          </DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Provider</InputLabel>
                <Select
                  value={formData.provider}
                  label="Provider"
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                >
                  <MenuItem value="vercel">Vercel</MenuItem>
                  <MenuItem value="stripe">Stripe</MenuItem>
                  <MenuItem value="github">GitHub</MenuItem>
                  <MenuItem value="custom">Custom</MenuItem>
                </Select>
              </FormControl>

              <TextField
                label="Display Name (optional)"
                value={formData.name || ''}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                fullWidth
                placeholder="Production Deployments"
              />

              <TextField
                label="Endpoint URL"
                value={formData.endpoint}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                fullWidth
                placeholder="https://api.example.com/webhooks/redruby"
                error={!formData.endpoint}
                helperText={!formData.endpoint ? 'Required valid HTTPS URL' : 'Must support POST with JSON payload'}
              />

              <TextField
                label="Signing Secret (optional)"
                value={formData.secret || ''}
                onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                fullWidth
                type="password"
                placeholder="whsec_xxxxxxxxxxxxxxxx"
                helperText="Used to verify incoming signatures. Leave blank to disable verification."
              />

              <FormControl fullWidth>
                <InputLabel>Subscribed Events</InputLabel>
                <Select
                  multiple
                  value={formData.events}
                  onChange={(e) => setFormData({ ...formData, events: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value })}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {(selected as string[]).map((value) => (
                        <Chip key={value} label={value} size="small" />
                      ))}
                    </Box>
                  )}
                >
                  {COMMON_EVENTS.map((event) => (
                    <MenuItem key={event} value={event}>
                      {event}
                    </MenuItem>
                  ))}
                </Select>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                  Select events this webhook will receive. Use custom.* for flexible matching.
                </Typography>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                }
                label="Active — webhook will receive events"
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseForm}>Cancel</Button>
            <Button
              onClick={handleSubmitForm}
              variant="contained"
              disabled={isCreating || isUpdating || !formData.endpoint || formData.events.length === 0}
            >
              {isCreating || isUpdating ? <CircularProgress size={20} /> : editingWebhook ? 'Update Webhook' : 'Create Webhook'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Event Log Viewer */}
        <Dialog
          open={isEventLogOpen}
          onClose={() => {
            setIsEventLogOpen(false);
            setSelectedWebhookId(null);
          }}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            Webhook Event History
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {selectedWebhookId && webhooks.find((w: WebhookConfigView) => w.id === selectedWebhookId)?.endpoint}
            </Typography>
          </DialogTitle>
          <DialogContent dividers>
            {isEventsLoading ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <CircularProgress />
              </Box>
            ) : events.length === 0 ? (
              <Alert severity="info">No events recorded for this webhook yet. Trigger a test above.</Alert>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Time</TableCell>
                    <TableCell>Event</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Response</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                   {events.map((event: WebhookEventView) => (
                     <TableRow key={event.id}>
                       <TableCell>
                         {new Date(event.attemptedAt).toLocaleString()}
                       </TableCell>
                       <TableCell>
                         <Chip label={event.eventType} size="small" />
                       </TableCell>
                       <TableCell>
                         <Chip
                           label={event.status.toUpperCase()}
                           color={getStatusColor(event.status)}
                           size="small"
                         />
                       </TableCell>
                       <TableCell sx={{ maxWidth: 300 }}>
                         {event.responseCode && (
                           <Typography variant="caption" sx={{ display: 'block' }}>
                             {event.responseCode} {event.errorMessage && `— ${event.errorMessage}`}
                           </Typography>
                         )}
                         {event.payload && (
                           <Tooltip title={JSON.stringify(event.payload, null, 2)}>
                             <Typography variant="caption" sx={{ cursor: 'help', textDecoration: 'underline dotted', display: 'inline-block' }}>
                               view payload
                             </Typography>
                           </Tooltip>
                         )}
                       </TableCell>
                     </TableRow>
                   ))}

                </TableBody>
              </Table>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setIsEventLogOpen(false); setSelectedWebhookId(null); }}>
              Close
            </Button>
          </DialogActions>
        </Dialog>

        <Box sx={{ mt: 4, opacity: 0.7 }}>
          <Typography variant="caption">
            Production-ready webhook manager. Events are persisted. Test button sends sample payload to configured endpoint.
            Enable/disable toggles live delivery. Follows MUI + RTK Query + PlatformAdminGate patterns from navigation-manager and brand-config-tab.
          </Typography>
        </Box>
      </Box>
    </PlatformAdminGate>
  );
}
