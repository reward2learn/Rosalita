'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatSettingsForm } from '@/components/config/chat-settings-form';
import { OpenAiKeyForm } from '@/components/config/openai-key-form';
import { SourceUploadForm } from '@/components/config/source-upload-form';
import { DataViewTab } from '@/components/config/data-view-tab';

export default function ConfigPage() {
  const [tab, setTab] = useState(0);

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
          </Tabs>

          {tab === 0 ? (
            <Stack spacing={3}>
              <OpenAiKeyForm />
              <ChatSettingsForm />
            </Stack>
          ) : null}

          {tab === 1 ? <SourceUploadForm /> : null}

          {tab === 2 ? <DataViewTab /> : null}
        </Stack>
      </Box>
    </AuthGate>
  );
}
