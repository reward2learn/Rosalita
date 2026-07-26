import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { OrdersView } from '@/components/orders/orders-view';

export default function OrdersPage() {
  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Suspense fallback={null}>
        <OrdersView />
      </Suspense>
    </AuthGate>
  );
}
