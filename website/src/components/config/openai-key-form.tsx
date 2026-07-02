'use client';

import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import {
  useClearOpenAiKeyMutation,
  useGetOpenAiKeyStatusQuery,
  useSaveOpenAiKeyMutation,
} from '@/store/apis/config-api';

function sourceLabel(source: 'db' | 'env' | null | undefined): string {
  if (source === 'db') return 'Stored in database';
  if (source === 'env') return 'Using server environment variable';
  return 'Not configured';
}

export function OpenAiKeyForm() {
  const { data, isLoading, isError, refetch } = useGetOpenAiKeyStatusQuery();
  const [saveKey, { isLoading: isSaving }] = useSaveOpenAiKeyMutation();
  const [clearKey, { isLoading: isClearing }] = useClearOpenAiKeyMutation();
  const [apiKey, setApiKey] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const statusPayload = data?.data;
  const configured = statusPayload?.configured ?? false;
  const source = statusPayload?.source ?? null;

  const handleSave = async () => {
    setStatus(null);
    setError(null);
    try {
      await saveKey({ apiKey }).unwrap();
      setApiKey('');
      setStatus('OpenAI API key saved.');
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save API key.');
    }
  };

  const handleClear = async () => {
    setStatus(null);
    setError(null);
    try {
      await clearKey().unwrap();
      setApiKey('');
      setStatus('Database API key removed. The server environment variable will be used if set.');
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove API key.');
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, border: '1px solid', borderColor: 'divider' }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            OpenAI API key
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Powers the ops chat assistant and voice synthesis. Keys are encrypted in the database.
          </Typography>
        </Box>

        {isLoading ? (
          <CircularProgress size={24} />
        ) : (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <Chip
              label={configured ? 'Configured' : 'Not configured'}
              color={configured ? 'success' : 'warning'}
              size="small"
            />
            <Typography variant="caption" color="text.secondary">
              {sourceLabel(source)}
            </Typography>
          </Stack>
        )}

        {isError ? (
          <Alert severity="error">Could not load API key status.</Alert>
        ) : null}
        {error ? <Alert severity="error">{error}</Alert> : null}
        {status ? <Alert severity="success">{status}</Alert> : null}

        <TextField
          label="OpenAI API key"
          type="password"
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          fullWidth
          autoComplete="off"
          helperText="Paste a new key to replace the stored value. The key is never shown after saving."
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            variant="contained"
            onClick={() => void handleSave()}
            disabled={isSaving || !apiKey.trim()}
          >
            {isSaving ? 'Saving…' : 'Save API key'}
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            onClick={() => void handleClear()}
            disabled={isClearing || source !== 'db'}
          >
            {isClearing ? 'Removing…' : 'Remove database key'}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
