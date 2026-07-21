'use client';

import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useAppSelector } from '@/store/hooks';

export interface PlatformAdminGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

function isPlatformAdminSession(platformAdmin: boolean | undefined, groups: string[]): boolean {
  return Boolean(platformAdmin) || groups.includes('platform-admin');
}

/**
 * Renders children only when the signed-in session is a platform administrator
 * (claim or platform-admin group). Otherwise shows the fallback — or, when already
 * signed in without admin rights, an access-denied message instead of re-prompting
 * for sign-in.
 */
export function PlatformAdminGate({ children, fallback }: PlatformAdminGateProps) {
  const { platformAdmin, bootstrapped, tier, groups } = useAppSelector((s) => s.auth);

  if (!bootstrapped) {
    return <p>Checking session…</p>;
  }

  if (isPlatformAdminSession(platformAdmin, groups ?? [])) {
    return <>{children}</>;
  }

  // Already authenticated but not platform admin — don't loop the sign-in form.
  if (tier !== 'public') {
    return (
      <Box sx={{ py: 6, px: 3, textAlign: 'center' }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
          Platform admin access required
        </Typography>
        <Typography variant="body2" color="text.secondary">
          You are signed in, but this page is limited to platform administrators.
          Sign out and use the Platform Admin role, or ask an admin to grant the
          platform-admin group.
        </Typography>
      </Box>
    );
  }

  return (
    fallback ?? (
      <p style={{ padding: 24, textAlign: 'center', color: '#888' }}>
        Platform admin access required.
      </p>
    )
  );
}
