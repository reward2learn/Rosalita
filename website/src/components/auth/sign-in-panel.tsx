'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Divider from '@mui/material/Divider';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AuthTier } from '@/lib/page-catalog';
import { PERSONS } from '@/domain/security/persons';
import { useGetSessionQuery, useVerifyPinMutation } from '@/store/apis/auth-api';

export interface SignInPanelProps {
  requiredTier: AuthTier;
}

/** Options derived from the live PIN-users endpoint, falling back to PERSONS. */
function usePinUsers(): { value: string; sub: string }[] {
  const [users, setUsers] = useState<{ value: string; sub: string }[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/auth?action=list-pin-users')
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.data?.users)) {
          const active = data.data.users
            .filter((u: { hasPin: boolean }) => u.hasPin)
            .map((u: { name: string; sub: string }) => ({ value: u.name, sub: u.sub }));
          setUsers(active.length > 0 ? active : PERSONS.map((p) => ({ value: p.name, sub: p.sub })));
        }
      })
      .catch(() => {
        // Fallback: show all known persons if the fetch fails.
        setUsers(PERSONS.map((p) => ({ value: p.name, sub: p.sub })));
      })
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded) return PERSONS.map((p) => ({ value: p.name, sub: p.sub }));
  return users;
}

export function SignInPanel({ requiredTier }: SignInPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const personOptions = usePinUsers();
  const [personName, setPersonName] = useState(personOptions[0]?.value ?? '');
  // Sync selected person when options resolve (e.g. after fetch completes).
  useEffect(() => {
    if (personOptions.length > 0 && !personOptions.some((o) => o.value === personName)) {
      setPersonName(personOptions[0].value);
    }
  }, [personOptions, personName]);
  const [verifyPin, { isLoading, isError, error }] = useVerifyPinMutation();
  const { refetch: refetchSession } = useGetSessionQuery();

  const oauthError = searchParams.get('auth') === 'error';
  const showPin = requiredTier === 'pin';
  const googleHref = googleAuthHref(pathname || '/dashboard');

  const handlePinSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pin.trim()) return;
    // Send the person's name so the endpoint can resolve the sub from PERSONS.
    const result = await verifyPin({ name: personName, pin: pin.trim() });
    if ('data' in result && result.data?.ok) {
      // Cookie is set on the verify-pin response; force a session refetch so
      // AuthProvider updates Redux state and the gate reveals admin content.
      await refetchSession();
    }
  };

  return (
    <Box
      component="section"
      sx={{ textAlign: 'center', py: 6, px: 3 }}
      data-testid="sign-in-panel"
    >
      <Box sx={{ maxWidth: 420, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {requiredTier === 'pin' ? 'Ops Sign-In' : 'Sign in to Access'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {requiredTier === 'pin'
            ? 'Enter the ops PIN or sign in with Google for full access.'
            : 'Sign in with Google to view the full business review, AI chat, and operations tracking.'}
        </Typography>

        {oauthError ? (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            Google sign-in failed. Try again or use the ops PIN.
          </Alert>
        ) : null}

        {isError ? (
          <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>
            {'data' in (error as object) && error && typeof error === 'object'
              ? String((error as { data?: { error?: string } }).data?.error ?? 'Incorrect PIN')
              : 'Incorrect PIN'}
          </Alert>
        ) : null}

        <Button
          component="a"
          href={googleHref}
          variant="contained"
          color="inherit"
          fullWidth
          sx={{
            bgcolor: '#fff',
            color: '#1a1a22',
            fontWeight: 600,
            mb: showPin ? 2 : 0,
            '&:hover': { bgcolor: '#f0f0f0' },
          }}
        >
          Sign in with Google
        </Button>

        {showPin ? (
          <>
            <Divider sx={{ my: 2.5 }}>
              <Typography variant="caption" color="text.secondary">
                or
              </Typography>
            </Divider>
            <Stack
              component="form"
              direction="column"
              spacing={1.5}
              onSubmit={handlePinSubmit}
            >
              <FormControl size="small" fullWidth>
                <InputLabel id="pin-role-label">User Account</InputLabel>
                <Select
                  labelId="pin-role-label"
                  label="User Account"
                  value={personName}
                  onChange={(e) => setPersonName(e.target.value)}
                  data-testid="pin-role-select"
                >
                  {personOptions.map((opt) => (
                    <MenuItem key={opt.sub} value={opt.value}>
                      {opt.value}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Stack direction="row" spacing={1}>
                <TextField
                  type="password"
                  placeholder="PIN"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  size="small"
                  fullWidth
                  autoComplete="off"
                  slotProps={{
                    htmlInput: { 'data-testid': 'pin-input', maxLength: 12 },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  color="primary"
                  disabled={!pin.trim() || isLoading}
                  data-testid="pin-submit"
                >
                  {isLoading ? '…' : 'Unlock'}
                </Button>
              </Stack>
            </Stack>
          </>
        ) : null}
      </Box>
    </Box>
  );
}

function googleAuthHref(redirectPath: string): string {
  return `/api/auth?action=google&redirect=${encodeURIComponent(redirectPath)}`;
}

export function SignInPanelGate(props: SignInPanelProps) {
  return (
    <Suspense
      fallback={
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.secondary">Loading sign-in…</Typography>
        </Box>
      }
    >
      <SignInPanel {...props} />
    </Suspense>
  );
}
