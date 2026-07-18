import { notFound } from 'next/navigation';
import Box from '@mui/material/Box';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { DocMarkdownBlock } from '@/components/blocks/doc-markdown-block';
import { ReviewNav } from '@/components/review/review-nav';
import { createClient } from '@/lib/db';
import { getReviewPartContent } from '@/domain/content/review-part-service';
import { resolveReviewPart } from '@/lib/page-catalog';

/** Avoid Prisma/Neon calls during `next build` static generation. */
export const dynamic = 'force-dynamic';

interface ReviewPartPageProps {
  params: Promise<{ partSlug: string }>;
}

export default async function ReviewPartPage({ params }: ReviewPartPageProps) {
  const { partSlug } = await params;
  const part = resolveReviewPart(partSlug);

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
