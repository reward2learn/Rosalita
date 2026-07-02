'use client';

import type { ReactNode } from 'react';
import type { AuthTier } from '@/lib/page-catalog';
import { useAppSelector } from '@/store/hooks';

const TIER_RANK: Record<AuthTier, number> = {
  public: 0,
  pin: 1,
  google: 2,
};

function tierAllowsAccess(current: AuthTier, required: AuthTier): boolean {
  return TIER_RANK[current] >= TIER_RANK[required];
}

export interface AuthGateProps {
  requiredTier: AuthTier;
  children: ReactNode;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
}

export function AuthGate({
  requiredTier,
  children,
  fallback = <p>Sign in required to view this page.</p>,
  loadingFallback = <p>Checking session…</p>,
}: AuthGateProps) {
  const { tier, bootstrapped } = useAppSelector((state) => state.auth);

  if (!bootstrapped) {
    return loadingFallback;
  }

  if (!tierAllowsAccess(tier, requiredTier)) {
    return fallback;
  }

  return children;
}
