'use client';

import type { ReactNode } from 'react';
import { useAppSelector } from '@/store/hooks';

export interface PlatformAdminGateProps {
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Renders children only when the signed-in session is a platform administrator
 * (Graham / reward2learn). Otherwise shows the fallback.
 */
export function PlatformAdminGate({ children, fallback }: PlatformAdminGateProps) {
  const { platformAdmin, bootstrapped } = useAppSelector((s) => s.auth);

  if (!bootstrapped) {
    return <p>Checking session…</p>;
  }
  if (!platformAdmin) {
    return (
      fallback ?? (
        <p style={{ padding: 24, textAlign: 'center', color: '#888' }}>
          Platform admin access required.
        </p>
      )
    );
  }
  return <>{children}</>;
}
