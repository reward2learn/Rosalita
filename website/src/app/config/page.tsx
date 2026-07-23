'use client';

import { Suspense, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatSettingsForm } from '@/components/config/chat-settings-form';
import { OpenAiKeyForm } from '@/components/config/openai-key-form';

const AiContentTab = dynamic(
  () => import('@/components/ops-admin/ai-content-tab').then((m) => ({ default: m.AiContentTab })),
  { ssr: false },
);
const SourceUploadForm = dynamic(
  () => import('@/components/config/source-upload-form').then((m) => ({ default: m.SourceUploadForm })),
  { ssr: false },
);
const DataViewTab = dynamic(
  () => import('@/components/config/data-view-tab').then((m) => ({ default: m.DataViewTab })),
  { ssr: false },
);

function ConfigPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab');
  const [tab, setTab] = useState(initialTab ? Math.min(Math.max(parseInt(initialTab, 10) || 0, 0), 3) : 0);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t) {
      setTab(Math.min(Math.max(parseInt(t, 10) || 0, 0), 3));
    }
  }, [searchParams]);

  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Config
          </Typography>

          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="AI Chat" />
            <Tab label="Source" />
            <Tab label="Data View" />
            <Tab label="AI Content Generation" />
          </Tabs>

          {tab === 0 ? (
            <Stack spacing={3}>
              <OpenAiKeyForm />
              <ChatSettingsForm />
            </Stack>
          ) : null}

          {tab === 1 ? <SourceUploadForm /> : null}

          {tab === 2 ? <DataViewTab /> : null}

          {tab === 3 ? <AiContentTab /> : null}
        </Stack>
      </Box>
    </AuthGate>
  );
}

export default function ConfigPage() {
  return (
    <Suspense fallback={null}>
      <ConfigPageInner />
    </Suspense>
  );
}
