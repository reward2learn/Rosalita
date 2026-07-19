'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { PlatformAdminGate } from '@/components/auth/platform-admin-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { useListRoleConfigsQuery, useSetRolePinMutation } from '@/store/apis/admin-api';

function RoleManager() {
  const { data, isLoading, isError, refetch } = useListRoleConfigsQuery();
  const [setRolePin, { isLoading: isSaving }] = useSetRolePinMutation();
  const [pinDraft, setPinDraft] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }
  if (isError || !data?.success) {
    return <Alert severity="error">Failed to load role configuration.</Alert>;
  }

  const roles = data.data.roles;

  const handleSave = async (code: string) => {
    const pin = pinDraft[code];
    if (!pin || pin.trim().length < 3) return;
    await setRolePin({ code, pin: pin.trim() }).unwrap();
    setPinDraft((prev) => ({ ...prev, [code]: '' }));
    setSaved(code);
    setTimeout(() => setSaved(null), 2500);
  };

  return (
    <Paper variant="outlined" sx={{ p: 3 }}>
      <Stack direction="row" sx={{ mb: 2, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>
          Role & PIN management
        </Typography>
        <Button size="small" variant="text" onClick={() => refetch()}>
          Refresh
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Each management role signs in with its own PIN. Platform-admin (Graham, reward2learn) uses the
        ADMIN_PIN and Google SSO. Set or rotate a PIN below.
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Role</TableCell>
            <TableCell>Name</TableCell>
            <TableCell>Email</TableCell>
            <TableCell>PIN set</TableCell>
            <TableCell>Set / rotate PIN</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {roles.map((role) => (
            <TableRow key={role.code}>
              <TableCell sx={{ fontWeight: 600 }}>{role.code}</TableCell>
              <TableCell>{role.name}</TableCell>
              <TableCell>{role.email ?? '—'}</TableCell>
              <TableCell>
                {role.pinConfigured ? (
                  <Chip label="configured" size="small" color="success" variant="outlined" />
                ) : (
                  <Chip label="not set" size="small" color="warning" variant="outlined" />
                )}
              </TableCell>
              <TableCell>
                <Stack direction="row" spacing={1}>
                  <TextField
                    type="password"
                    size="small"
                    placeholder="new PIN"
                    value={pinDraft[role.code] ?? ''}
                    onChange={(e) =>
                      setPinDraft((prev) => ({ ...prev, [role.code]: e.target.value }))
                    }
                    slotProps={{ htmlInput: { maxLength: 12 } }}
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isSaving || !(pinDraft[role.code] ?? '').trim()}
                    onClick={() => handleSave(role.code)}
                  >
                    Save
                  </Button>
                  {saved === role.code ? <Chip label="saved" size="small" color="success" /> : null}
                </Stack>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}

export default function AdminPage() {
  return (
    <PlatformAdminGate
      fallback={<SignInPanelGate requiredTier="pin" />}
    >
      <Box sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Platform Admin
          </Typography>
          <RoleManager />
        </Stack>
      </Box>
    </PlatformAdminGate>
  );
}
