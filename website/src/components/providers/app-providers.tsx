import type { ReactNode } from 'react';
import { StoreProvider } from '@/components/providers/store-provider';
import { AuthProvider } from '@/components/auth/auth-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <StoreProvider>
      <AuthProvider>{children}</AuthProvider>
    </StoreProvider>
  );
}
