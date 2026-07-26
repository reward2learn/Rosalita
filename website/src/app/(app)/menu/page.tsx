import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { MenuView } from '@/components/menu/menu-view';

export default function MenuPage() {
  return (
    <AuthGate requiredTier="public" fallback={<SignInPanelGate requiredTier="public" />}>
      <Suspense fallback={null}>
        <MenuView />
      </Suspense>
    </AuthGate>
  );
}
