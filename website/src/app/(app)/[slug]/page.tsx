import { notFound } from 'next/navigation';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DynamicPage } from '@/components/dynamic/dynamic-page';
import { resolvePage } from '@/lib/page-catalog';
import type { PageDefinition, AuthTier } from '@/lib/page-catalog';

interface SlugPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Resolve a page definition — first checks the in-memory page catalog,
 * then falls back to the database app_pages table (for dynamically
 * generated pages that survive serverless cold starts).
 */
async function resolvePageWithDb(slug: string): Promise<PageDefinition | null> {
  // 1) In-memory catalog (static + dynamically registered this session)
  const fromCatalog = resolvePage(slug);
  if (fromCatalog) return fromCatalog;

  // 2) Database fallback (pages seeded by workbook analysis)
  try {
    const { PrismaClient } = await import('@/generated/prisma');
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
    if (!url) return null;
    const prisma = new PrismaClient({ datasources: { db: { url } } });
    try {
      const row = await prisma.appPage.findUnique({
        where: { slug },
        include: { sections: { orderBy: { sortOrder: 'asc' } } },
      });
      if (row) {
        return {
          slug: row.slug,
          title: row.title,
          authTier: (row.authTier ?? 'google') as AuthTier,
          sections: row.sections.map((s) => ({
            blockType: s.blockType as PageDefinition['sections'][number]['blockType'],
            config: (s.config ?? {}) as Record<string, unknown>,
          })),
        };
      }
    } finally {
      await prisma.$disconnect();
    }
  } catch {
    // DB unavailable
  }

  return null;
}

export default async function SlugPage({ params }: SlugPageProps) {
  const { slug } = await params;
  const page = await resolvePageWithDb(slug);

  if (!page) {
    notFound();
  }

  return (
    <AuthGate requiredTier={page.authTier} fallback={<SignInPanelGate requiredTier={page.authTier} />}>
      <DynamicPage page={page} />
    </AuthGate>
  );
}
