'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import LinearProgress from '@mui/material/LinearProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import TableChartIcon from '@mui/icons-material/TableChart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

// ── Types ──────────────────────────────────────────────

interface AiContentStatus {
  promptLength: number;
  promptPreview: string;
  /** Full prompt text (provided by the latest GET response). */
  fullPrompt?: string;
  dataSummary: string;
  existingContent: {
    executiveSummary: string | null;
    reviewParts: number;
  } | null;
  excelPeriod: string;
  excelCompany: string;
  tabs: string[];
}

/** Matches the ProgressEvent from content-generator.ts */
interface ProgressEvent {
  step:
    | 'extracting'
    | 'prompt'
    | 'openai'
    | 'parsing'
    | 'saving'
    | 'saving_exec'
    | 'complete'
    | 'error';
  message: string;
  pct: number;
  detail?: unknown;
}

interface GenerateResult {
  promptLength?: number;
  contentLengths?: {
    businessReview: number;
    executiveSummary: number;
  };
  saved?: {
    businessReviewParts: { slug: string; title: string }[];
    executiveSummarySaved: boolean;
  };
  model?: string;
}

/** Ordered list of steps for the timeline visualiser */
const STEPS: { key: ProgressEvent['step']; label: string }[] = [
  { key: 'extracting', label: 'Reading Excel workbook' },
  { key: 'prompt', label: 'Building AI prompt' },
  { key: 'openai', label: 'Calling OpenAI' },
  { key: 'parsing', label: 'Parsing AI response' },
  { key: 'saving', label: 'Saving to database' },
  { key: 'saving_exec', label: 'Saving Executive Summary' },
];

/** Map step → 0-based index for timeline ordering */
const STEP_INDEX: Record<string, number> = {};
STEPS.forEach((s, i) => {
  STEP_INDEX[s.key] = i;
});
STEP_INDEX['complete'] = STEPS.length;
STEP_INDEX['error'] = -1;

// ── Helper: fuzzy step label for the notification ──────

function stepLabel(step: string): string {
  const found = STEPS.find((s) => s.key === step);
  if (found) return found.label;
  if (step === 'complete') return 'Complete';
  if (step === 'error') return 'Error';
  return step;
}

// ── Component ───────────────────────────────────────────

export function AiContentTab() {
  const [status, setStatus] = useState<AiContentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Generation state
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  const [showFullDataSummary, setShowFullDataSummary] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Clear-seed state
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<Record<string, number> | null>(null);

  // ── Additional context from AI Findings ───────────────
  const [additionalContext, setAdditionalContext] = useState<string | null>(null);

  // ── Generate confirm dialog ────────────────────────────
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);

  useEffect(() => {
    const ctx = sessionStorage.getItem('ai_findings_generation_context');
    if (ctx) {
      setAdditionalContext(ctx);
      sessionStorage.removeItem('ai_findings_generation_context');
    }
  }, []);

  const clearAdditionalContext = useCallback(() => {
    setAdditionalContext(null);
  }, []);

  // ── Fetch initial status ──────────────────────────────

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/admin/ai-content');
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const payload = await res.json();
      if (payload.success) {
        setStatus(payload.data);
      } else {
        throw new Error(payload.error ?? 'Unknown error');
      }
    } catch (err) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  // ── SSE generation handler ────────────────────────────

  const openGenerateConfirm = useCallback(() => {
    setGenerateConfirmOpen(true);
  }, []);

  const runGeneration = useCallback(async () => {
    setGenerateConfirmOpen(false);

    // Reset state
    setGenerating(true);
    setGenerateError(null);
    setResult(null);
    setProgress({ step: 'extracting', message: 'Starting generation...', pct: 0 });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/admin/ai-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          additionalContext: additionalContext || undefined,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(errBody.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error('Response has no body stream');
      }

      // Read the SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE messages from buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep incomplete line in buffer

        let currentEvent = '';
        let currentData = '';

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6).trim();
          } else if (line === '') {
            // Empty line = end of event
            if (currentData) {
              try {
                const parsed = JSON.parse(currentData) as ProgressEvent;
                handleSseEvent(parsed);
              } catch {
                // ignore malformed JSON
              }
            }
            currentEvent = '';
            currentData = '';
          }
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setProgress({
          step: 'error',
          message: 'Generation cancelled by user.',
          pct: 0,
        });
        setGenerateError('Cancelled');
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setProgress({
          step: 'error',
          message: msg,
          pct: 0,
        });
        setGenerateError(msg);
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
      // Refresh status after generation completes or fails
      void fetchStatus();
    }
  }, [fetchStatus]);

  /** Process a single SSE progress event */
  const handleSseEvent = useCallback((event: ProgressEvent) => {
    setProgress(event);

    if (event.step === 'complete') {
      const detail = event.detail as
        | {
            businessReviewParts?: { slug: string; title: string }[];
            executiveSummarySaved?: boolean;
            contentLengths?: { businessReview: number; executiveSummary: number };
            model?: string;
          }
        | undefined;
      setResult({
        saved: {
          businessReviewParts: detail?.businessReviewParts ?? [],
          executiveSummarySaved: detail?.executiveSummarySaved ?? false,
        },
        contentLengths: detail?.contentLengths ?? {
          businessReview: 0,
          executiveSummary: 0,
        },
        model: detail?.model,
      });
    }

    if (event.step === 'error') {
      setGenerateError(event.message);
    }
  }, []);

  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Clear seeded data ────────────────────────────────

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
        // Refresh status after clearing
        void fetchStatus();
      } else {
        setClearError(payload.error ?? 'Clear failed');
      }
    } catch (err) {
      setClearError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }, [fetchStatus]);

  // ── Helpers ───────────────────────────────────────────

  const copyPrompt = useCallback(() => {
    if (!status?.fullPrompt && !status?.promptPreview) return;
    void navigator.clipboard.writeText(status.fullPrompt ?? status.promptPreview);
  }, [status]);

  /** Determine which steps are completed / active / pending */
  function stepState(
    key: string,
  ): 'completed' | 'active' | 'pending' | 'error' {
    if (!progress) return 'pending';
    if (progress.step === 'error') return key === progress.step ? 'error' : 'pending';
    const currentIdx = STEP_INDEX[progress.step] ?? -1;
    const stepIdx = STEP_INDEX[key] ?? -1;
    if (stepIdx < currentIdx) return 'completed';
    if (stepIdx === currentIdx) return 'active';
    return 'pending';
  }

  // ── Loading state ─────────────────────────────────────

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (fetchError && !status) {
    return (
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {fetchError}
        </Alert>
        <Button variant="outlined" onClick={fetchStatus}>
          Retry
        </Button>
      </Paper>
    );
  }

  // ── Render ────────────────────────────────────────────

  return (
    <Stack spacing={3}>
      {/* ── Header / workbook info ───────────────────── */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
          AI Content Generation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Automatically generate the Business Review and Executive Summary from
          the June 2026 Excel workbook. The system reads the workbook, builds a
          comprehensive data prompt, calls OpenAI, and saves the generated
          Markdown to the database. No manual file uploads needed.
        </Typography>

        {status ? (
          <Stack spacing={1}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', alignItems: 'center' }}
            >
              <Chip
                icon={<TableChartIcon />}
                label={`Period: ${status.excelPeriod}`}
                size="small"
              />
              <Chip label={status.excelCompany} size="small" />
              <Chip label={`${status.tabs.length} sheets`} size="small" />
              <Chip
                icon={<DescriptionIcon />}
                label={`Prompt: ${(status.promptLength / 1000).toFixed(0)}K chars`}
                size="small"
                variant="outlined"
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Sheets: {status.tabs.join(', ')}
            </Typography>
          </Stack>
        ) : null}
      </Paper>

      {/* ── Existing content status ──────────────────── */}
      {status?.existingContent ? (
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Currently Saved Content
          </Typography>
          <Stack direction="row" spacing={2} sx={{ flexWrap: 'wrap' }}>
            <Chip
              icon={
                status.existingContent.reviewParts > 0 ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <WarningAmberIcon color="warning" />
                )
              }
              label={`${status.existingContent.reviewParts} Business Review part(s)`}
              color={
                status.existingContent.reviewParts > 0 ? 'success' : 'warning'
              }
              variant="outlined"
            />
            <Chip
              icon={
                status.existingContent.executiveSummary ? (
                  <CheckCircleIcon color="success" />
                ) : (
                  <WarningAmberIcon color="warning" />
                )
              }
              label={
                status.existingContent.executiveSummary
                  ? 'Executive Summary saved'
                  : 'No Executive Summary'
              }
              color={
                status.existingContent.executiveSummary ? 'success' : 'warning'
              }
              variant="outlined"
            />
          </Stack>
          {status.existingContent.executiveSummary ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 1, fontStyle: 'italic' }}
            >
              Preview: {status.existingContent.executiveSummary}
            </Typography>
          ) : null}
        </Paper>
      ) : null}

      {/* ── Progress area (shown only during generation) ── */}
      {generating || progress ? (
        <Paper
          variant="outlined"
          sx={{
            p: 3,
            borderColor: progress?.step === 'error' ? 'error.main' : progress?.step === 'complete' ? 'success.main' : 'primary.main',
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 2 }}>
            {progress?.step === 'complete'
              ? 'Generation Complete'
              : progress?.step === 'error'
                ? 'Generation Failed'
                : 'Generating Content...'}
          </Typography>

          {/* ── Progress bar ─────────────────────────── */}
          <Box sx={{ mb: 2.5 }}>
            <LinearProgress
              variant="determinate"
              value={progress?.pct ?? 0}
              color={
                progress?.step === 'error'
                  ? 'error'
                  : progress?.step === 'complete'
                    ? 'success'
                    : 'primary'
              }
              sx={{ height: 8, borderRadius: 4 }}
            />
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 0.5, display: 'block', textAlign: 'right' }}
            >
              {progress?.pct ?? 0}%
            </Typography>
          </Box>

          {/* ── Live notification banner ─────────────── */}
          {progress && progress.step !== 'complete' && progress.step !== 'error' ? (
            <Alert
              severity="info"
              icon={<AutoFixHighIcon />}
              sx={{ mb: 2, '& .MuiAlert-message': { width: '100%' } }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {stepLabel(progress.step)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {progress.message}
              </Typography>
            </Alert>
          ) : null}

          {/* ── Success notification ─────────────────── */}
          {progress?.step === 'complete' ? (
            <Alert severity="success" icon={<CheckCircleIcon />} sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {progress.message}
              </Typography>
            </Alert>
          ) : null}

          {/* ── Error notification ───────────────────── */}
          {progress?.step === 'error' && generateError ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {generateError}
              </Typography>
              {(progress.detail as { hint?: string })?.hint ? (
                <Typography variant="caption" color="text.secondary">
                  Tip: {(progress.detail as { hint: string }).hint}
                </Typography>
              ) : null}
            </Alert>
          ) : null}

          {/* ── Step timeline ────────────────────────── */}
          <Stack spacing={1}>
            {STEPS.map((step) => {
              const state = stepState(step.key);
              return (
                <Stack
                  key={step.key}
                  direction="row"
                  spacing={1.5}
                  sx={{ alignItems: 'center', opacity: state === 'pending' ? 0.4 : 1 }}
                >
                  {/* Step indicator icon */}
                  {state === 'completed' ? (
                    <CheckCircleIcon
                      fontSize="small"
                      color="success"
                      sx={{ flexShrink: 0 }}
                    />
                  ) : state === 'active' ? (
                    <CircularProgress size={18} sx={{ flexShrink: 0 }} />
                  ) : state === 'error' ? (
                    <WarningAmberIcon
                      fontSize="small"
                      color="error"
                      sx={{ flexShrink: 0 }}
                    />
                  ) : (
                    <RadioButtonUncheckedIcon
                      fontSize="small"
                      color="disabled"
                      sx={{ flexShrink: 0 }}
                    />
                  )}
                  {/* Step label */}
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: state === 'active' ? 700 : 400,
                      color:
                        state === 'active'
                          ? 'primary.main'
                          : state === 'completed'
                            ? 'success.main'
                            : state === 'error'
                              ? 'error.main'
                              : 'text.secondary',
                    }}
                  >
                    {step.label}
                  </Typography>
                  {/* Current step progress message */}
                  {state === 'active' && progress ? (
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ ml: 1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {progress.message}
                    </Typography>
                  ) : null}
                </Stack>
              );
            })}
          </Stack>

          {/* ── Generation result summary ────────────── */}
          {result ? (
            <Box sx={{ mt: 2 }}>
              <Stack
                direction="row"
                spacing={2}
                sx={{ flexWrap: 'wrap' }}
              >
                <Chip
                  icon={<DescriptionIcon />}
                  label={`Business Review: ${((result.contentLengths?.businessReview ?? 0) / 1000).toFixed(0)}K chars`}
                  size="small"
                />
                <Chip
                  icon={<SummarizeIcon />}
                  label={`Executive Summary: ${((result.contentLengths?.executiveSummary ?? 0) / 1000).toFixed(0)}K chars`}
                  size="small"
                />
                {result.model ? (
                  <Chip
                    label={`Model: ${result.model}`}
                    size="small"
                    variant="outlined"
                  />
                ) : null}
              </Stack>
              {result.saved ? (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="body2" color="success.main" sx={{ fontWeight: 600 }}>
                    Saved to Database:
                  </Typography>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {result.saved.businessReviewParts.map((part) => (
                      <li key={part.slug}>
                        <Typography variant="body2">{part.title}</Typography>
                      </li>
                    ))}
                    {result.saved.executiveSummarySaved ? (
                      <li>
                        <Typography variant="body2">
                          Executive Summary
                        </Typography>
                      </li>
                    ) : null}
                  </ul>
                </Box>
              ) : null}
            </Box>
          ) : null}
        </Paper>
      ) : null}

      {/* ── Data summary accordion ──────────────────── */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            Excel Data Summary
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography
            variant="body2"
            component="pre"
            sx={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              fontSize: '0.8rem',
              bgcolor: 'rgba(0,0,0,0.3)',
              p: 2,
              borderRadius: 1,
            }}
          >
            {status?.dataSummary ?? 'No data extracted.'}
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* ── AI Findings context (if provided) ────────── */}
      {additionalContext ? (
        <Accordion
          defaultExpanded
          elevation={0}
          sx={{
            border: '1px solid',
            borderColor: 'primary.main',
            bgcolor: 'rgba(235, 61, 40, 0.06)',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 700, color: 'primary.main' }}>
                📋 AI Findings Context
              </Typography>
              <Chip label={`${additionalContext.length.toLocaleString()} chars`} size="small" variant="outlined" color="primary" />
              <Button
                size="small"
                variant="text"
                color="inherit"
                onClick={(e) => { e.stopPropagation(); clearAdditionalContext(); }}
                sx={{ minWidth: 0, p: 0.5, color: 'text.disabled' }}
              >
                ✕ Remove
              </Button>
            </Stack>
          </AccordionSummary>
          <AccordionDetails>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                bgcolor: 'rgba(0,0,0,0.3)',
                p: 2,
                borderRadius: 1,
                maxHeight: 300,
                overflow: 'auto',
              }}
            >
              {additionalContext}
            </Typography>
          </AccordionDetails>
        </Accordion>
      ) : null}

      {/* ── Prompt preview accordion ────────────────── */}
      <Accordion
        expanded={showFullPrompt}
        onChange={() => setShowFullPrompt((p) => !p)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            AI Generation Prompt (
            {status
              ? `${(status.promptLength / 1000).toFixed(0)}K chars`
              : '...'}
            )
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyIcon />}
              onClick={copyPrompt}
              sx={{ alignSelf: 'flex-start' }}
            >
              Copy Preview
            </Button>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.75rem',
                bgcolor: 'rgba(0,0,0,0.3)',
                p: 2,
                borderRadius: 1,
                maxHeight: 400,
                overflow: 'auto',
              }}
            >
              {status?.promptPreview ?? 'Loading...'}
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ── Full Prompt accordion ─────────────────────── */}
      <Accordion
        expanded={showFullDataSummary || showFullPrompt}
        onChange={() => setShowFullPrompt((p) => !p)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700 }}>
            Full Generation Prompt
            {status ? ` (${(status.promptLength / 1000).toFixed(0)}K chars)` : ''}
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={() => {
                  if (status?.fullPrompt) navigator.clipboard.writeText(status.fullPrompt);
                }}
              >
                Copy Full Prompt
              </Button>
            </Stack>
            <Typography
              variant="body2"
              component="pre"
              sx={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace',
                fontSize: '0.7rem',
                bgcolor: 'rgba(0,0,0,0.3)',
                p: 2,
                borderRadius: 1,
                maxHeight: 500,
                overflow: 'auto',
              }}
            >
              {status?.fullPrompt ?? status?.promptPreview ?? 'Loading...'}
            </Typography>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ── Action buttons ──────────────────────────── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <Button
          variant="contained"
          size="large"
          disabled={generating}
          onClick={openGenerateConfirm}
          startIcon={
            generating ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <AutoFixHighIcon />
            )
          }
          sx={{ py: 1.5 }}
        >
          {generating
            ? 'Generating...'
            : 'Generate Business Review & Executive Summary'}
        </Button>
        {generating ? (
          <Button
            variant="outlined"
            color="warning"
            onClick={handleCancel}
            sx={{ py: 1.5 }}
          >
            Cancel
          </Button>
        ) : null}
        <Button
          variant="outlined"
          onClick={fetchStatus}
          disabled={generating}
          startIcon={<TableChartIcon />}
        >
          Refresh Data Status
        </Button>
      </Stack>

      {/* ── Danger Zone: Clear All Seeded Data ──────────── */}
      <Divider sx={{ my: 1 }} />
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
            Delete all seeded content from the database — financial projections, business review
            parts, knowledge snippets, tasks, roles, monthly targets, and app pages.
            <strong> This cannot be undone.</strong> Operational data (Z-reports, conversations,
            user accounts) is preserved.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            After clearing, upload a new workbook via the Config page and re-seed to regenerate
            everything from scratch.
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
            <Alert severity="error" onClose={() => setClearError(null)}>
              {clearError}
            </Alert>
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

      {/* ── Generate confirm dialog ──────────────────────── */}
      <Dialog open={generateConfirmOpen} onClose={() => setGenerateConfirmOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoFixHighIcon color="primary" />
          Generate Business Review, Executive Summary &amp; Dashboard
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              This will generate the Business Review, Executive Summary, and Dashboard content
              {additionalContext ? ' incorporating your selected AI Findings.' : '.'}
            </Typography>
            <Box sx={{ pl: 1 }}>
              <Typography variant="body2" component="div" sx={{ '& li': { mb: 0.5 } }}>
                <ol style={{ margin: 0, paddingLeft: '1.2rem' }}>
                  <li>Read the June 2026 Excel workbook data seeded</li>
                  {additionalContext ? <li>Add the AI findings to the data to generate response</li> : null}
                  <li>Build a comprehensive AI prompt from the data and instructions</li>
                  <li>Call OpenAI to generate all documents</li>
                  <li>Save to the database: Executive Summary, Detailed Review, and Dashboard content (overwriting existing content)</li>
                </ol>
              </Typography>
            </Box>
            {additionalContext ? (
              <Alert severity="info" icon={<AutoFixHighIcon />}>
                AI Findings context ({additionalContext.length.toLocaleString()} chars) will be included in the generation.
              </Alert>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Existing content will be overwritten. This cannot be undone.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setGenerateConfirmOpen(false)} color="inherit">Cancel</Button>
          <Button variant="contained" onClick={runGeneration} startIcon={<AutoFixHighIcon />}>
            Generate
          </Button>
        </DialogActions>
      </Dialog>

      {/* ── Confirmation dialog ─────────────────────────── */}
      <Dialog open={clearConfirmOpen} onClose={() => { if (!clearing) { setClearConfirmOpen(false); setClearConfirmText(''); } }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>
          ⚠️ Clear All Seeded Data?
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <DialogContentText>
              This will permanently delete all seeded content from the database:
            </DialogContentText>
            <Typography variant="body2" component="div" sx={{ pl: 2 }}>
              <ul style={{ margin: 0 }}>
                <li>Financial projections</li>
                <li>Business Review parts</li>
                <li>Knowledge snippets &amp; workbook cache</li>
                <li>Tasks, roles, and task assignments</li>
                <li>Action items and levers</li>
                <li>Monthly targets</li>
                <li>App pages and page sections</li>
                <li>Daily metrics and monthly actuals</li>
              </ul>
            </Typography>
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
          <Button
            onClick={() => {
              setClearConfirmOpen(false);
              setClearConfirmText('');
            }}
            disabled={clearing}
          >
            Cancel
          </Button>
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
  );
}
