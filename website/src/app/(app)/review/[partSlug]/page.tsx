import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DocMarkdownBlock } from '@/components/blocks/doc-markdown-block';
import { ReviewNav } from '@/components/review/review-nav';
import { createClient } from '@/lib/db';
import { getReviewPartContent } from '@/domain/content/review-part-service';
import { resolveReviewPart, setDynamicReviewParts } from '@/lib/page-catalog';
import type { ReviewPartDefinition } from '@/lib/page-catalog';

/** Avoid Prisma/Neon calls during `next build` static generation. */
export const dynamic = 'force-dynamic';

interface ReviewPartPageProps {
  params: Promise<{ partSlug: string }>;
}

export default async function ReviewPartPage({ params }: ReviewPartPageProps) {
  const { partSlug } = await params;

  // 1) Try the in-memory catalog first (static A–G or dynamically registered H–O)
  let part = resolveReviewPart(partSlug);

  // 2) If not in catalog, try loading from the DB (e.g. AI-generated parts)
  if (!part && process.env.POSTGRES_URL) {
    try {
      const { PrismaClient } = await import('@/generated/prisma');
      const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;
      if (url) {
        const prisma = new PrismaClient({ datasources: { db: { url } } });
        try {
          const row = await prisma.businessReviewPart.findUnique({
            where: { slug: partSlug },
          });
          if (row) {
            part = {
              partSlug: row.slug,
              partKey: row.partKey,
              title: row.title ?? '',
              authTier: (row.authTier ?? 'google') as 'public' | 'pin' | 'google',
            };
            // Register in the in-memory catalog for subsequent requests
            setDynamicReviewParts([
              ...Object.values(
                (await import('@/lib/page-catalog')).getReviewPartCatalog(),
              ),
              part,
            ]);
          }
        } finally {
          await prisma.$disconnect();
        }
      }
    } catch {
      // DB unavailable — 404
    }
  }

  if (!part) {
    notFound();
  }

  let initialMarkdown: string | undefined;
  if (process.env.POSTGRES_URL) {
    const content = await getReviewPartContent(createClient(), partSlug);
    initialMarkdown = content?.markdown;
  }

  return (
    <AuthGate requiredTier={part.authTier} fallback={<SignInPanelGate requiredTier={part.authTier} />}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          width: '100%',
          mx: 'auto',
          gap: { xs: 0, md: 2 },
        }}
      >
        <ReviewNav currentSlug={partSlug} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DocMarkdownBlock
            config={{
              source: `review:${part.partSlug}`,
              title: part.title,
            }}
            initialMarkdown={initialMarkdown}
          />
        </Box>
      </Box>
    </AuthGate>
  );
}
