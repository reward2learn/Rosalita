'use client';

import { Suspense, type FormEvent, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { AuthTier } from '@/lib/page-catalog';
import { useVerifyPinMutation } from '@/store/apis/auth-api';

export interface SignInPanelProps {
  requiredTier: AuthTier;
}

export function SignInPanel({ requiredTier }: SignInPanelProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [verifyPin, { isLoading, isError, error }] = useVerifyPinMutation();

  const oauthError = searchParams.get('auth') === 'error';
  const showPin = requiredTier === 'pin';
  const googleHref = googleAuthHref(pathname || '/dashboard');

  const handlePinSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!pin.trim()) return;
    await verifyPin({ pin: pin.trim() });
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
              direction="row"
              spacing={1}
              onSubmit={handlePinSubmit}
            >
              <TextField
                type="password"
                placeholder="Ops PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                size="small"
                fullWidth
                autoComplete="off"
                slotProps={{
                  htmlInput: { 'data-testid': 'pin-input', maxLength: 10 },
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
