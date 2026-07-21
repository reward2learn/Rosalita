'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
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
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { PlatformAdminGate } from '@/components/auth/platform-admin-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { AiContentTab } from '@/components/ops-admin/ai-content-tab';
import { BrandConfigTab } from '@/components/ops-admin/brand-config-tab';
import {
  useListRoleConfigsQuery,
  useListAdminConversationsQuery,
  useArchiveAdminConversationMutation,
  useListAdminUsersQuery,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useListAdminGroupsQuery,
  useCreateAdminGroupMutation,
  useUpdateAdminGroupMutation,
} from '@/store/apis/admin-api';
import type { AdminUserView } from '@/app/api/admin/users/route';
import type { AdminGroupView } from '@/app/api/admin/groups/route';
import { FUNCTIONAL_ROLES } from '@/domain/security/functional-roles';
import { PERSONS } from '@/domain/security/persons';
import { CAPABILITY_AREAS, capability } from '@/domain/security/capabilities';

function RoleManager() {
  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
        Functional Role Catalog
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each functional role is assigned to one person. Manage PINs in the User Accounts tab.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            <TableCell>Person</TableCell>
            <TableCell>Email</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {FUNCTIONAL_ROLES.map((fr) => {
            const person = PERSONS.find((p) => p.roleCode === fr.code);
            return (
              <TableRow key={fr.code}>
                <TableCell sx={{ fontWeight: 600 }}>{fr.name}</TableCell>
                <TableCell>{person?.name ?? '—'}</TableCell>
                <TableCell>{person?.email ?? '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Paper>
  );
}

function ConversationManager() {
  const { data, isLoading, isError, refetch } = useListAdminConversationsQuery({ limit: 100 });
  const [archive, { isLoading: isArchiving }] = useArchiveAdminConversationMutation();
  const [showArchived, setShowArchived] = useState(false);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data?.success) {
    return <Alert severity="error">Failed to load conversations.</Alert>;
  }

  const conversations = (data.data.conversations ?? []).filter((c) => showArchived || !c.archived);

  const handleToggle = async (id: number, archived: boolean) => {
    await archive({ id, archived: !archived }).unwrap();
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          AI Chat Conversations
        </Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Button size="small" variant="text" onClick={() => refetch()}>
            Refresh
          </Button>
          <Button
            size="small"
            variant={showArchived ? 'contained' : 'outlined'}
            onClick={() => setShowArchived((prev) => !prev)}
          >
            {showArchived ? 'Hide archived' : 'Show archived'}
          </Button>
        </Stack>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Archive a conversation to remove it from the user&apos;s saved list (last 20 non-archived are shown).
        Platform admins can archive any conversation.
      </Typography>
      {conversations.length === 0 ? (
        <Typography variant="body2" color="text.secondary">No conversations.</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>User</TableCell>
              <TableCell>Messages</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right">Archive</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {conversations.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{c.id}</TableCell>
                <TableCell sx={{ maxWidth: 280 }}>{c.title}</TableCell>
                <TableCell>{c.user_name}{c.owner_sub ? ` (${c.owner_sub})` : ''}</TableCell>
                <TableCell>{c.message_count}</TableCell>
                <TableCell>{new Date(c.created_at).toLocaleString()}</TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant={c.archived ? 'outlined' : 'contained'}
                    color={c.archived ? 'inherit' : 'warning'}
                    disabled={isArchiving}
                    onClick={() => void handleToggle(c.id, c.archived)}
                  >
                    {c.archived ? 'Unarchive' : 'Archive'}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Paper>
  );
}

function UserManager() {
  const { data, isLoading, isError, refetch } = useListAdminUsersQuery();
  const [updateUser, { isLoading: isUpdating }] = useUpdateAdminUserMutation();
  const [deleteUser, { isLoading: isDeleting }] = useDeleteAdminUserMutation();
  const { data: groupsData } = useListAdminGroupsQuery();
  // Fetch PIN config status (maps functional role code → pinConfigured).
  const { data: roleConfigData } = useListRoleConfigsQuery();
  const [editing, setEditing] = useState<{
    id: string; sub: string; email: string; isActive: boolean; roleCode: string | null;
    groupCodes: string[]; pin: string;
  } | null>(null);
  const [details, setDetails] = useState<AdminUserView | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const allGroups = groupsData?.data.groups ?? [];

  // Build PIN status map (functional role code → configured).
  const pinStatus: Record<string, boolean> = {};
  if (roleConfigData?.success && roleConfigData.data.roles) {
    for (const r of roleConfigData.data.roles) {
      pinStatus[r.code] = r.pinConfigured;
    }
  }

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data?.success) {
    return <Alert severity="error">Failed to load users.</Alert>;
  }

  const users = data.data.users ?? [];

  const openEditor = (user: AdminUserView) => {
    setEditing({
      id: user.id, sub: user.sub, email: user.email ?? '',
      isActive: user.isActive, roleCode: user.roleCode,
      groupCodes: user.groups, pin: '',
    });
  };

  const handleSave = async () => {
    if (!editing) return;
    await updateUser({
      id: editing.id,
      email: editing.email || undefined,
      isActive: editing.isActive,
      roleCode: editing.roleCode,
      groupCodes: editing.groupCodes,
      pin: editing.pin || undefined,
    }).unwrap();
    setEditing(null);
    refetch();
  };

  const handleDelete = async () => {
    if (!editing) return;
    await deleteUser({ id: editing.id, sub: editing.sub }).unwrap();
    setEditing(null);
    setDeleteConfirm(null);
    refetch();
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          User Accounts
        </Typography>
        <Button size="small" variant="text" onClick={() => refetch()}>
          Refresh
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Manage user accounts: assign roles, set PINs, and configure group memberships.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Person</TableCell>
            <TableCell>Role</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>PIN</TableCell>
            <TableCell align="right">Actions</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((u) => {
            const hasPin = u.roleCode ? (pinStatus[u.roleCode] ?? false) : false;
            return (
              <TableRow key={u.id}>
                <TableCell sx={{ fontWeight: 600 }}>
                  {u.name ?? u.sub}
                  {!u.isActive ? (
                    <Chip label="disabled" size="small" color="error" variant="outlined" sx={{ ml: 1 }} />
                  ) : null}
                </TableCell>
                <TableCell>{FUNCTIONAL_ROLES.find((r) => r.code === u.roleCode)?.name ?? u.roleCode ?? '—'}</TableCell>
                <TableCell>{u.email ?? '—'}</TableCell>
                <TableCell>
                  {hasPin ? (
                    <Chip label="configured" size="small" color="success" variant="outlined" />
                  ) : (
                    <Chip label="not set" size="small" color="warning" variant="outlined" />
                  )}
                </TableCell>
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} sx={{ justifyContent: 'flex-end' }}>
                    <Tooltip title="View groups & capabilities">
                      <IconButton size="small" onClick={() => setDetails(u)} aria-label="View details">
                        <InfoOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button size="small" variant="outlined" onClick={() => openEditor(u)}>
                      Edit
                    </Button>
                  </Stack>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Details modal: groups + capabilities */}
      <Dialog open={Boolean(details)} onClose={() => setDetails(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{details?.name ?? details?.sub}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="caption" color="text.secondary">
              {details?.email ?? '—'}
            </Typography>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Security groups</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {details && details.groups.length ? (
                  details.groups.map((g) => (
                    <Chip key={g} label={g} size="small" variant="outlined" />
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary">none</Typography>
                )}
              </Stack>
            </Box>
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Capabilities</Typography>
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                {details && details.permissions.includes('*') ? (
                  <Chip label="all" size="small" color="primary" variant="outlined" />
                ) : details && details.permissions.length ? (
                  details.permissions.map((p) => (
                    <Chip key={p} label={p} size="small" variant="outlined" />
                  ))
                ) : (
                  <Typography variant="caption" color="text.secondary">none</Typography>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setDetails(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Edit modal */}
      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Manage {users.find((u) => u.id === editing?.id)?.name ?? editing?.id}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <FormControl fullWidth size="small">
              <InputLabel id="user-status-label">Status</InputLabel>
              <Select
                labelId="user-status-label"
                label="Status"
                value={editing ? (editing.isActive ? 'active' : 'disabled') : 'active'}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, isActive: e.target.value === 'active' } : prev)}
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="disabled">Disabled</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="user-role-label">Functional role</InputLabel>
              <Select
                labelId="user-role-label"
                label="Functional role"
                value={editing?.roleCode ?? ''}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, roleCode: e.target.value || null } : prev)}
              >
                <MenuItem value="">— none —</MenuItem>
                {FUNCTIONAL_ROLES.map((fr) => (
                  <MenuItem key={fr.code} value={fr.code}>{fr.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth size="small">
              <InputLabel id="user-groups-label">Security groups</InputLabel>
              <Select
                labelId="user-groups-label"
                label="Security groups"
                multiple
                value={editing?.groupCodes ?? []}
                onChange={(e) => setEditing((prev) => prev ? { ...prev, groupCodes: e.target.value as string[] } : prev)}
                renderValue={(selected) => (selected as string[]).join(', ')}
              >
                {allGroups.map((g) => (
                  <MenuItem key={g.code} value={g.code}>{g.name}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              size="small"
              label="Email"
              type="email"
              placeholder="user@example.com"
              value={editing?.email ?? ''}
              onChange={(e) => setEditing((prev) => prev ? { ...prev, email: e.target.value } : prev)}
            />
            <TextField
              type="password"
              size="small"
              label="Set / rotate PIN"
              placeholder="new PIN (min 3 chars)"
              value={editing?.pin ?? ''}
              onChange={(e) => setEditing((prev) => prev ? { ...prev, pin: e.target.value } : prev)}
              slotProps={{ htmlInput: { maxLength: 12 } }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          {deleteConfirm === editing?.id ? (
            <>
              <Button size="small" color="error" variant="contained" disabled={isDeleting} onClick={handleDelete}>
                {isDeleting ? 'Deleting…' : 'Confirm delete'}
              </Button>
              <Button size="small" variant="text" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            </>
          ) : (
            <>
              <Button size="small" color="error" variant="text" onClick={() => setDeleteConfirm(editing?.id ?? null)}>
                Delete
              </Button>
              <Button size="small" variant="text" onClick={() => setEditing(null)}>Cancel</Button>
              <Button size="small" variant="contained" disabled={isUpdating} onClick={() => void handleSave()}>Save</Button>
            </>
          )}
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

function GroupManager() {
  const { data, isLoading, isError, refetch } = useListAdminGroupsQuery();
  const [createGroup, { isLoading: isCreating }] = useCreateAdminGroupMutation();
  const [updateGroup, { isLoading: isUpdating }] = useUpdateAdminGroupMutation();
  const [newGroup, setNewGroup] = useState<{ code: string; name: string; description: string }>({ code: '', name: '', description: '' });
  const [editing, setEditing] = useState<{ code: string; name: string; description: string | null; permissions: string[] } | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data?.success) {
    return <Alert severity="error">Failed to load groups.</Alert>;
  }

  const groups = data.data.groups ?? [];

  const handleCreate = async () => {
    if (!newGroup.code.trim() || !newGroup.name.trim()) return;
    await createGroup({ code: newGroup.code.trim().toLowerCase(), name: newGroup.name.trim(), description: newGroup.description.trim() }).unwrap();
    setNewGroup({ code: '', name: '', description: '' });
    refetch();
  };

  const openEditor = (g: AdminGroupView) => {
    setEditing({ code: g.code, name: g.name, description: g.description, permissions: [...g.permissions] });
  };

  const toggleCap = (cap: string) => {
    setEditing((prev) => {
      if (!prev) return prev;
      const has = prev.permissions.includes(cap);
      return {
        ...prev,
        permissions: has ? prev.permissions.filter((c) => c !== cap) : [...prev.permissions, cap],
      };
    });
  };

  const handleSavePerms = async () => {
    if (!editing) return;
    await updateGroup({ code: editing.code, permissions: editing.permissions }).unwrap();
    setEditing(null);
    refetch();
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Security Groups
        </Typography>
        <Button size="small" variant="text" onClick={() => refetch()}>
          Refresh
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Groups gate API calls and routes by membership. Each group grants a set of capabilities
        (read/write per area). Platform admins are implicitly granted every capability.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Code</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Description</TableCell>
            <TableCell>Capabilities</TableCell>
            <TableCell>System</TableCell>
            <TableCell align="right">Members</TableCell>
            <TableCell align="right">Manage</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {groups.map((g) => (
            <TableRow key={g.code}>
              <TableCell sx={{ fontWeight: 600 }}>{g.code}</TableCell>
              <TableCell>{g.name}</TableCell>
              <TableCell>{g.description ?? '—'}</TableCell>
              <TableCell>
                <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap' }} useFlexGap>
                  {g.permissions.includes('*') ? (
                    <Chip label="all" size="small" color="primary" variant="outlined" />
                  ) : g.permissions.length ? (
                    g.permissions.map((p) => (
                      <Chip key={p} label={p} size="small" variant="outlined" />
                    ))
                  ) : (
                    <Typography variant="caption" color="text.secondary">none</Typography>
                  )}
                </Stack>
              </TableCell>
              <TableCell>{g.isSystem ? <Chip label="system" size="small" color="info" variant="outlined" /> : null}</TableCell>
              <TableCell align="right">{g.memberCount}</TableCell>
              <TableCell align="right">
                <Button size="small" variant="outlined" disabled={g.isSystem} onClick={() => openEditor(g)}>
                  Permissions
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
        <TextField size="small" label="Code" value={newGroup.code} onChange={(e) => setNewGroup((p) => ({ ...p, code: e.target.value }))} placeholder="e.g. marketing" />
        <TextField size="small" label="Name" value={newGroup.name} onChange={(e) => setNewGroup((p) => ({ ...p, name: e.target.value }))} placeholder="Marketing" />
        <TextField size="small" label="Description" value={newGroup.description} onChange={(e) => setNewGroup((p) => ({ ...p, description: e.target.value }))} sx={{ flex: 1 }} />
        <Button size="small" variant="contained" disabled={isCreating || !newGroup.code.trim() || !newGroup.name.trim()} onClick={() => void handleCreate()}>
          Add group
        </Button>
      </Stack>

      <Dialog open={Boolean(editing)} onClose={() => setEditing(null)} maxWidth="sm" fullWidth>
        <DialogTitle>Capabilities — {editing?.code}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {CAPABILITY_AREAS.map((area) => (
              <Box key={area.area}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{area.label}</Typography>
                <Stack direction="row" spacing={2}>
                  {area.accesses.map((acc) => {
                    const cap = capability(area.area, acc);
                    return (
                      <FormControlLabel
                        key={cap}
                        control={
                          <Checkbox
                            checked={editing?.permissions.includes(cap) ?? false}
                            onChange={() => toggleCap(cap)}
                          />
                        }
                        label={acc === 'use' ? 'Use' : acc === 'read' ? 'Read' : 'Write'}
                      />
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setEditing(null)}>Cancel</Button>
          <Button size="small" variant="contained" disabled={isUpdating} onClick={() => void handleSavePerms()}>Save</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default function AdminPage() {
  const [tab, setTab] = useState(0);
  return (
    <PlatformAdminGate
      fallback={<SignInPanelGate requiredTier="pin" />}
    >
      <Box sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Platform Admin
          </Typography>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="Brand Config" />
            <Tab label="AI Content Generation" />
            <Tab label="Security Groups" />
            <Tab label="User Accounts" />
            <Tab label="User Roles" />
            <Tab label="User Conversations" />
          </Tabs>
          {tab === 0 ? <BrandConfigTab /> : null}
          {tab === 1 ? <AiContentTab /> : null}
          {tab === 2 ? <GroupManager /> : null}
          {tab === 3 ? <UserManager /> : null}
          {tab === 4 ? <RoleManager /> : null}
          {tab === 5 ? <ConversationManager /> : null}
        </Stack>
      </Box>
    </PlatformAdminGate>
  );
}
