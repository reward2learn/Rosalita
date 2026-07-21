'use client';

import { useCallback, useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DescriptionIcon from '@mui/icons-material/Description';

// ── Types from seed-details API ─────────────────────────

interface SeedDetails {
  counts: Record<string, number>;
  pageDetails: { slug: string; title: string; authTier: string; sectionCount: number }[];
  reviewPartDetails: { slug: string; title: string; partKey: string; markdownLength: number; markdownPreview: string }[];
  snippetDetails: { key: string; category: string; contentLength: number; contentPreview: string }[];
  taskDetails: { title: string; priority: string; status: string; roles: string[] }[];
  roleDetails: { code: string; name: string; email: string | null }[];
  targetDetails: { month: string; targetRevenue: number; targetEbitda: number; targetGuests: number }[];
  leverDetails: { num: number; name: string; impact: string }[];
  actionItemDetails: { priority: string; label: string; completed: boolean }[];
  executiveSummary: string | null;
  seedStatus?: { ok: boolean; warnings: string[]; totalTables: number; totalRows: number };
}

interface CategoryConfig {
  key: string;
  table: string;
  label: string;
  icon: string;
  count: number;
  detail: unknown[];
  renderDetail: () => React.ReactNode;
}

// ── Table name to display label mapping ─────────────────

const TABLE_META: Record<string, { label: string; icon: string }> = {
  financial_projections: { label: 'Financial Projections', icon: '📊' },
  business_review_parts: { label: 'Business Review Parts', icon: '📝' },
  knowledge_snippets: { label: 'Knowledge Snippets', icon: '🧠' },
  tasks: { label: 'Tasks', icon: '✅' },
  task_assignments: { label: 'Task Assignments', icon: '🔗' },
  roles: { label: 'Roles', icon: '👤' },
  monthly_targets: { label: 'Monthly Targets', icon: '🎯' },
  levers: { label: 'Levers', icon: '🔧' },
  action_items: { label: 'Action Items', icon: '📋' },
  app_pages: { label: 'App Pages', icon: '📄' },
  page_sections: { label: 'Page Sections', icon: '🧩' },
  daily_metrics: { label: 'Daily Metrics', icon: '📅' },
  monthly_actual_departments: { label: 'Monthly Actuals (Dept)', icon: '📁' },
  monthly_actual_inputs: { label: 'Monthly Actual Inputs', icon: '📥' },
};

function formatCount(n: number): string {
  if (n < 0) return 'error';
  return String(n);
}

export function DataViewTab() {
  const [details, setDetails] = useState<SeedDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearResult, setClearResult] = useState<Record<string, number> | null>(null);

  const fetchDetails = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/config/seed-details');
      if (res.ok) {
        const payload = await res.json();
        if (payload.success) setDetails(payload);
        else setError(payload.error ?? 'Failed to load');
      } else {
        setError(`HTTP ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchDetails(); }, [fetchDetails]);

  // ── Derived categories ────────────────────────────────

  const categories: CategoryConfig[] = details ? [
    {
      key: 'app_pages', table: 'app_pages', label: 'App Pages', icon: '📄',
      count: details.counts.appPages ?? 0, detail: details.pageDetails,
      renderDetail: () => details.pageDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Slug</TableCell><TableCell>Title</TableCell><TableCell>Tier</TableCell><TableCell align="right">Sections</TableCell></TableRow></TableHead><TableBody>
          {details.pageDetails.map((p) => <TableRow key={p.slug}><TableCell>{p.slug}</TableCell><TableCell>{p.title}</TableCell><TableCell>{p.authTier}</TableCell><TableCell align="right">{p.sectionCount}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No pages seeded.</Typography>,
    },
    {
      key: 'business_review', table: 'business_review_parts', label: 'Business Review Parts', icon: '📝',
      count: details.reviewPartDetails.length, detail: details.reviewPartDetails,
      renderDetail: () => details.reviewPartDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Part</TableCell><TableCell>Title</TableCell><TableCell align="right">Length</TableCell></TableRow></TableHead><TableBody>
          {details.reviewPartDetails.map((p) => <TableRow key={p.slug}><TableCell>{p.partKey}</TableCell><TableCell>{p.title}</TableCell><TableCell align="right">{(p.markdownLength / 1000).toFixed(1)}K</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No review parts seeded.</Typography>,
    },
    {
      key: 'knowledge_snippets', table: 'knowledge_snippets', label: 'Knowledge Snippets', icon: '🧠',
      count: details.snippetDetails.length, detail: details.snippetDetails,
      renderDetail: () => details.snippetDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Key</TableCell><TableCell>Category</TableCell><TableCell align="right">Length</TableCell></TableRow></TableHead><TableBody>
          {details.snippetDetails.map((s) => <TableRow key={s.key}><TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.key}</TableCell><TableCell>{s.category}</TableCell><TableCell align="right">{(s.contentLength / 1000).toFixed(1)}K</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No snippets seeded.</Typography>,
    },
    {
      key: 'tasks', table: 'tasks', label: 'Tasks', icon: '✅',
      count: details.taskDetails.length, detail: details.taskDetails,
      renderDetail: () => details.taskDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Task</TableCell><TableCell>Priority</TableCell><TableCell>Status</TableCell><TableCell>Roles</TableCell></TableRow></TableHead><TableBody>
          {details.taskDetails.map((t, i) => <TableRow key={i}><TableCell>{t.title}</TableCell><TableCell>{t.priority}</TableCell><TableCell>{t.status}</TableCell><TableCell>{t.roles.join(', ') || '—'}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No tasks seeded.</Typography>,
    },
    {
      key: 'roles', table: 'roles', label: 'Roles', icon: '👤',
      count: details.roleDetails.length, detail: details.roleDetails,
      renderDetail: () => details.roleDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Code</TableCell><TableCell>Name</TableCell><TableCell>Email</TableCell></TableRow></TableHead><TableBody>
          {details.roleDetails.map((r) => <TableRow key={r.code}><TableCell>{r.code}</TableCell><TableCell>{r.name}</TableCell><TableCell>{r.email ?? '—'}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No roles seeded.</Typography>,
    },
    {
      key: 'monthly_targets', table: 'monthly_targets', label: 'Monthly Targets', icon: '🎯',
      count: details.targetDetails.length, detail: details.targetDetails,
      renderDetail: () => details.targetDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Month</TableCell><TableCell align="right">Revenue</TableCell><TableCell align="right">EBITDA</TableCell><TableCell align="right">Guests</TableCell></TableRow></TableHead><TableBody>
          {details.targetDetails.map((t) => <TableRow key={t.month}><TableCell>{t.month}</TableCell><TableCell align="right">{t.targetRevenue.toLocaleString('id-ID')}</TableCell><TableCell align="right">{t.targetEbitda.toLocaleString('id-ID')}</TableCell><TableCell align="right">{t.targetGuests}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No targets seeded.</Typography>,
    },
    {
      key: 'levers', table: 'levers', label: 'Levers', icon: '🔧',
      count: details.leverDetails.length, detail: details.leverDetails,
      renderDetail: () => details.leverDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>#</TableCell><TableCell>Name</TableCell><TableCell>Impact</TableCell></TableRow></TableHead><TableBody>
          {details.leverDetails.map((l) => <TableRow key={l.num}><TableCell>{l.num}</TableCell><TableCell>{l.name}</TableCell><TableCell>{l.impact}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No levers seeded.</Typography>,
    },
    {
      key: 'action_items', table: 'action_items', label: 'Action Items', icon: '📋',
      count: details.actionItemDetails.length, detail: details.actionItemDetails,
      renderDetail: () => details.actionItemDetails.length > 0 ? (
        <Table size="small"><TableHead><TableRow><TableCell>Priority</TableCell><TableCell>Action</TableCell><TableCell>Done</TableCell></TableRow></TableHead><TableBody>
          {details.actionItemDetails.map((a, i) => <TableRow key={i}><TableCell>{a.priority}</TableCell><TableCell>{a.label}</TableCell><TableCell>{a.completed ? '✓' : '—'}</TableCell></TableRow>)}
        </TableBody></Table>
      ) : <Typography variant="body2" color="text.secondary">No action items seeded.</Typography>,
    },
    {
      key: 'financial_projections', table: 'financial_projections', label: 'Financial Projections', icon: '📊',
      count: details.counts.financialProjections ?? 0, detail: [],
      renderDetail: () => <Typography variant="body2" color="text.secondary">Financial projections: {details.counts.financialProjections ?? 0} rows.</Typography>,
    },
  ] : [];

  // ── Selection ─────────────────────────────────────────

  const toggleCategory = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === categories.length) setSelected(new Set());
    else setSelected(new Set(categories.map((c) => c.key)));
  };

  // ── Clear selected ────────────────────────────────────

  const handleClearSelected = useCallback(async () => {
    const selectedTables = categories
      .filter((c) => selected.has(c.key))
      .map((c) => c.table);

    setClearing(true);
    setClearError(null);
    setClearResult(null);

    try {
      const res = await fetch('/api/admin/clear-seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'selected',
          tables: selectedTables,
          confirm: 'CLEAR SELECTED',
        }),
      });
      const payload = await res.json();
      if (payload.success) {
        setClearResult(payload.data.deleted);
        setConfirmOpen(false);
        setConfirmText('');
        setSelected(new Set());
        void fetchDetails();
      } else {
        setClearError(payload.error ?? 'Clear failed');
      }
    } catch (err) {
      setClearError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearing(false);
    }
  }, [selected, categories, fetchDetails]);

  // ── Loading / error ───────────────────────────────────

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>;
  }

  if (error && !details) {
    return <Alert severity="error">{error}</Alert>;
  }

  // ── Render ────────────────────────────────────────────

  return (
    <Stack spacing={3}>
      {/* Summary header */}
      <Paper variant="outlined" sx={{ p: 3 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Seeded Data Overview</Typography>
            <Typography variant="body2" color="text.secondary">
              {details?.seedStatus
                ? `${details.seedStatus.totalRows} rows across ${details.seedStatus.totalTables} tables`
                : 'Loading...'}
            </Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={fetchDetails}>Refresh</Button>
        </Stack>
      </Paper>

      {/* Seed status warnings */}
      {details?.seedStatus?.warnings && details.seedStatus.warnings.length > 0 ? (
        <Alert severity="warning">
          {details.seedStatus.warnings.map((w, i) => <div key={i}>{w}</div>)}
        </Alert>
      ) : null}

      {/* Categories */}
      {categories.map((cat) => (
        <Accordion key={cat.key} elevation={0} sx={{ border: '1px solid', borderColor: 'divider', '&:before': { display: 'none' } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', width: '100%', pr: 2 }}>
              <Checkbox
                checked={selected.has(cat.key)}
                onChange={() => toggleCategory(cat.key)}
                onClick={(e) => e.stopPropagation()}
                size="small"
              />
              <Typography variant="body2" sx={{ fontSize: '1.1rem' }}>{cat.icon}</Typography>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{cat.label}</Typography>
              </Box>
              <Chip label={`${cat.count} rows`} size="small" variant="outlined" color={cat.count > 0 ? 'primary' : 'default'} />
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            {cat.renderDetail()}
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider />

      {/* Action area */}
      <Paper variant="outlined" sx={{ p: 3, borderColor: selected.size > 0 ? 'error.main' : 'divider', borderStyle: selected.size > 0 ? 'dashed' : 'solid' }}>
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Checkbox checked={selected.size === categories.length && categories.length > 0} indeterminate={selected.size > 0 && selected.size < categories.length} onChange={toggleAll} />}
              label={`${selected.size} of ${categories.length} categories selected`}
            />
            <Button
              variant="contained"
              color="error"
              disabled={selected.size === 0 || clearing}
              onClick={() => setConfirmOpen(true)}
              startIcon={clearing ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
            >
              {clearing ? 'Clearing...' : `Delete Selected (${selected.size})`}
            </Button>
            <Button variant="outlined" color="error" disabled={clearing} onClick={() => setSelected(new Set(categories.map((c) => c.key)))}>
              Select All
            </Button>
          </Stack>

          {clearError ? <Alert severity="error" onClose={() => setClearError(null)}>{clearError}</Alert> : null}

          {clearResult ? (
            <Alert severity="success" icon={<CheckCircleIcon />}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Selected data cleared.</Typography>
              <Typography variant="caption" component="div">
                {Object.entries(clearResult).filter(([, c]) => c > 0).map(([t, c]) => `${TABLE_META[t]?.label ?? t}: ${c} rows`).join('\n')}
              </Typography>
            </Alert>
          ) : null}
        </Stack>
      </Paper>

      {/* Confirmation dialog */}
      <Dialog open={confirmOpen} onClose={() => { if (!clearing) { setConfirmOpen(false); setConfirmText(''); } }} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>⚠️ Delete Selected Seeded Data?</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <DialogContentText>
              This will permanently delete the following seeded data:
            </DialogContentText>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              {categories.filter((c) => selected.has(c.key)).map((c) => (
                <li key={c.key}><Typography variant="body2">{c.icon} {c.label} ({c.count} rows)</Typography></li>
              ))}
            </Box>
            <DialogContentText sx={{ fontWeight: 600, color: 'error.main' }}>This cannot be undone.</DialogContentText>
            <DialogContentText>
              Type <strong>CLEAR SELECTED</strong> below to confirm:
            </DialogContentText>
            <TextField fullWidth size="small" placeholder="CLEAR SELECTED" value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)} autoFocus
              error={confirmText.length > 0 && confirmText !== 'CLEAR SELECTED'}
              helperText={confirmText.length > 0 && confirmText !== 'CLEAR SELECTED' ? 'Type the exact phrase' : ''}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => { setConfirmOpen(false); setConfirmText(''); }} disabled={clearing}>Cancel</Button>
          <Button variant="contained" color="error"
            disabled={confirmText !== 'CLEAR SELECTED' || clearing}
            onClick={handleClearSelected}
            startIcon={clearing ? <CircularProgress size={18} color="inherit" /> : <DeleteSweepIcon />}
          >{clearing ? 'Clearing...' : 'Delete Selected'}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
