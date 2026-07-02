import { notFound } from 'next/navigation';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DynamicPage } from '@/components/dynamic/dynamic-page';
import { resolvePage } from '@/lib/page-catalog';

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params;
  const page = resolvePage(slug);

  if (!page) {
    notFound();
  }

  return (
    <AuthGate requiredTier={page.authTier} fallback={<SignInPanelGate requiredTier={page.authTier} />}>
      <DynamicPage page={page} />
    </AuthGate>
  );
}
