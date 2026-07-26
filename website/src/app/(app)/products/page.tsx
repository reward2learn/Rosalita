import { Suspense } from 'react';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ProductsView } from '@/components/products/products-view';

export default function ProductsPage() {
  return (
    <AuthGate requiredTier="public" fallback={<SignInPanelGate requiredTier="public" />}>
      <Suspense fallback={null}>
        <ProductsView />
      </Suspense>
    </AuthGate>
  );
}
