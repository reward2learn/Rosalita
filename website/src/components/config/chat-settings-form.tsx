'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import Typography from '@mui/material/Typography';
import {
  useGetChatSettingsQuery,
  useUpdateChatSettingsMutation,
} from '@/store/apis/config-api';

export function ChatSettingsForm() {
  const { data, isLoading, isError } = useGetChatSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateChatSettingsMutation();
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (data?.data) {
      setWebSearchEnabled(data.data.webSearchEnabled);
    }
  }, [data]);

  const handleToggle = async (checked: boolean) => {
    setWebSearchEnabled(checked);
    setStatus(null);
    setError(null);
    try {
      await updateSettings({ webSearchEnabled: checked }).unwrap();
      setStatus(checked
        ? 'Web search enabled for the assistant.'
        : 'Web search disabled for the assistant.');
    } catch (err) {
      setWebSearchEnabled(!checked);
      setError(err instanceof Error ? err.message : 'Could not update chat settings.');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Chat assistant
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Control whether the ops chat assistant can search the web for current information.
          </Typography>
        </Box>

        {isLoading ? (
          <CircularProgress size={24} />
        ) : (
          <FormControlLabel
            control={(
              <Switch
                checked={webSearchEnabled}
                onChange={(event) => void handleToggle(event.target.checked)}
                disabled={isSaving}
              />
            )}
            label="Enable web search"
          />
        )}

        <Typography variant="caption" color="text.secondary">
          When enabled, the assistant can use OpenAI web search for live data, news, and current facts.
        </Typography>

        {isError ? (
          <Alert severity="error">Could not load chat settings.</Alert>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {status ? <Alert severity="success">{status}</Alert> : null}
      </Stack>
    </Paper>
  );
}
