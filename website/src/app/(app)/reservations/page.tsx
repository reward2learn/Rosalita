import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ReservationsView } from '@/components/reservations/reservations-view';

export default function ReservationsPage() {
  return (
    <AuthGate requiredTier="public" fallback={<SignInPanelGate requiredTier="public" />}>
      <Suspense fallback={null}>
        <ReservationsView />
      </Suspense>
    </AuthGate>
  );
}
