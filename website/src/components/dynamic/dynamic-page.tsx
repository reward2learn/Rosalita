'use client';

import Box from '@mui/material/Box';
import type { AuthTier, PageDefinition } from '@/lib/page-catalog';
import { getBlockComponent } from '@/lib/block-registry';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import type { BlockType } from '@/lib/page-catalog';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { PdfExportButton } from '@/components/ui/pdf-export-button';
import { useAppSelector } from '@/store/hooks';

export interface DynamicPageProps {
  page: PageDefinition;
}

function DashboardSignInPrompt() {
  return <SignInPanelGate requiredTier="google" />;
}

function BlockSection({
  blockType,
  config,
  index,
}: {
  blockType: BlockType;
  config: Record<string, unknown>;
  index: number;
}) {
  const Component = getBlockComponent(blockType);
  const parsed = parseBlockConfig(blockType, config);
  const minTier = 'minTier' in parsed ? (parsed.minTier as AuthTier | undefined) : undefined;

  const block = <Component config={config} />;

  if (!minTier || minTier === 'public') {
    return <Box key={`${blockType}-${index}`}>{block}</Box>;
  }

  return (
    <AuthGate key={`${blockType}-${index}`} requiredTier={minTier} fallback={null}>
      {block}
    </AuthGate>
  );
}

export function DynamicPage({ page }: DynamicPageProps) {
  const tier = useAppSelector((s) => s.auth.tier);
  const showSignIn = page.slug === 'dashboard' && tier === 'public';

  return (
    <Box component="main" id="pdfCapture">
      <Box
        component="h1"
        sx={{
          position: 'absolute',
          width: 1,
          height: 1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
        }}
      >
        {page.title}
      </Box>

      {page.pdfExport ? (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 3, pt: 2 }}>
          <PdfExportButton page={`/${page.slug}`} label="PDF" />
        </Box>
      ) : null}

      {page.sections.map((section, index) => (
        <BlockSection
          key={`${section.blockType}-${index}`}
          blockType={section.blockType}
          config={section.config}
          index={index}
        />
      ))}

      {showSignIn ? <DashboardSignInPrompt /> : null}
    </Box>
  );
}
