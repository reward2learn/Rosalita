import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DynamicPage } from '@/components/dynamic/dynamic-page';
import { resolvePage } from '@/lib/page-catalog';

export default function ReviewPage() {
  const page = resolvePage('review');

  if (!page) {
    return null;
  }

  return (
    <AuthGate requiredTier={page.authTier} fallback={<SignInPanelGate requiredTier={page.authTier} />}>
      <DynamicPage page={page} />
    </AuthGate>
  );
}
