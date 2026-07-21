'use client';

import { useCallback, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { ChatSettingsForm } from '@/components/config/chat-settings-form';
import { OpenAiKeyForm } from '@/components/config/openai-key-form';
import { SourceUploadForm } from '@/components/config/source-upload-form';

export default function ConfigPage() {
  const [tab, setTab] = useState(0);

  // ── Clear seed state ──────────────────────────────────
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<Record<string, number> | null>(null);

  const handleClearSeed = useCallback(async () => {
    setClearing(true);
    setClearError(null);
    setClearResult(null);
    try {
      const res = await fetch('/api/admin/clear-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'CLEAR ALL SEEDED DATA' }),
      });
      const payload = await res.json();
      if (payload.success) {
        setClearResult(payload.data.deleted);
        setClearConfirmOpen(false);
        setClearConfirmText('');
      } else {
        setClearError(payload.error ?? 'Clear failed');
      }
    } catch (err) {
      setClearError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }, []);

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

          {/* ── AI Chat tab ──────────────────────────────── */}
          {tab === 0 ? (
            <Stack spacing={3}>
              <OpenAiKeyForm />
              <ChatSettingsForm />
            </Stack>
          ) : null}

          {/* ── Source tab ────────────────────────────────── */}
          {tab === 1 ? <SourceUploadForm /> : null}

          {/* ── Data View tab ─────────────────────────────── */}
          {tab === 2 ? (
            <Stack spacing={3}>
              <SourceUploadForm showSummaryOnly />

              {/* Danger Zone: Clear All Seeded Data */}
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderColor: 'error.main',
                  borderStyle: 'dashed',
                  bgcolor: 'rgba(211,47,47,0.04)',
                }}
              >
                <Stack spacing={2}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                    <DeleteSweepIcon color="error" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'error.main' }}>
                      Danger Zone: Clear All Seeded Data
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Delete all seeded content — financial projections, business review parts, knowledge snippets,
                    tasks, roles, monthly targets, and app pages. <strong>This cannot be undone.</strong>
                    Operational data (Z-reports, conversations, user accounts) is preserved.
                  </Typography>

                  <Box>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => setClearConfirmOpen(true)}
                      disabled={clearing}
                      startIcon={clearing ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
                      sx={{ borderColor: 'error.main', '&:hover': { borderColor: 'error.dark' } }}
                    >
                      {clearing ? 'Clearing...' : 'Clear All Seeded Data'}
                    </Button>
                  </Box>

                  {clearError ? (
                    <Alert severity="error" onClose={() => setClearError(null)}>{clearError}</Alert>
                  ) : null}

                  {clearResult ? (
                    <Alert severity="success" icon={<CheckCircleIcon />}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                        Seeded data cleared successfully.
                      </Typography>
                      <Typography variant="caption" component="div">
                        {Object.entries(clearResult)
                          .filter(([, count]) => count > 0)
                          .map(([table, count]) => `${table}: ${count} rows deleted`)
                          .join('\n')}
                      </Typography>
                    </Alert>
                  ) : null}
                </Stack>
              </Paper>

              {/* Clear confirmation dialog */}
              <Dialog open={clearConfirmOpen} onClose={() => { if (!clearing) { setClearConfirmOpen(false); setClearConfirmText(''); } }} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontWeight: 700 }}>⚠️ Clear All Seeded Data?</DialogTitle>
                <DialogContent dividers>
                  <Stack spacing={2}>
                    <DialogContentText>
                      This will permanently delete all seeded content from the database.
                    </DialogContentText>
                    <DialogContentText sx={{ fontWeight: 600, color: 'error.main' }}>
                      This action cannot be undone.
                    </DialogContentText>
                    <DialogContentText>
                      Type <strong>CLEAR ALL SEEDED DATA</strong> below to confirm:
                    </DialogContentText>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="CLEAR ALL SEEDED DATA"
                      value={clearConfirmText}
                      onChange={(e) => setClearConfirmText(e.target.value)}
                      autoFocus
                      error={clearConfirmText.length > 0 && clearConfirmText !== 'CLEAR ALL SEEDED DATA'}
                      helperText={
                        clearConfirmText.length > 0 && clearConfirmText !== 'CLEAR ALL SEEDED DATA'
                          ? 'Type the exact phrase to confirm'
                          : ''
                      }
                    />
                  </Stack>
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                  <Button onClick={() => { setClearConfirmOpen(false); setClearConfirmText(''); }} disabled={clearing}>Cancel</Button>
                  <Button
                    variant="contained"
                    color="error"
                    disabled={clearConfirmText !== 'CLEAR ALL SEEDED DATA' || clearing}
                    onClick={handleClearSeed}
                    startIcon={clearing ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
                  >
                    {clearing ? 'Clearing...' : 'Clear All Seeded Data'}
                  </Button>
                </DialogActions>
              </Dialog>
            </Stack>
          ) : null}
        </Stack>
      </Box>
    </AuthGate>
  );
}
