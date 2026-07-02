'use client';

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatSettingsForm } from '@/components/config/chat-settings-form';
import { OpenAiKeyForm } from '@/components/config/openai-key-form';
import { SourceUploadForm } from '@/components/config/source-upload-form';

export default function ConfigPage() {
  return (
    <AuthGate requiredTier="pin" fallback={<SignInPanelGate requiredTier="pin" />}>
      <Box sx={{ maxWidth: 920, mx: 'auto', px: 3, py: 3 }}>
        <Stack spacing={3}>
          <Typography variant="h4" sx={{ fontWeight: 800 }}>
            Config
          </Typography>
          <OpenAiKeyForm />
          <ChatSettingsForm />
          <SourceUploadForm />
        </Stack>
      </Box>
    </AuthGate>
  );
}
