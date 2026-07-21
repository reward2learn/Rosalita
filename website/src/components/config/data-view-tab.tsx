'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
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
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';

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
      renderDetail: () => {
        if (details.pageDetails.length === 0) return <Typography variant="body2" color="text.secondary">No pages seeded.</Typography>;
        return (
          <Table size="small"><TableHead><TableRow><TableCell>Slug</TableCell><TableCell>Title</TableCell><TableCell>Tier</TableCell><TableCell align="right">Sections</TableCell></TableRow></TableHead><TableBody>
            {details.pageDetails.map((p) => (
              <TableRow key={p.slug} hover sx={{ cursor: 'pointer' }} onClick={() => window.location.href = `/${p.slug}`}>
                <TableCell>
                  <Link href={`/${p.slug}`} style={{ textDecoration: 'none', color: 'inherit' }} onClick={(e) => e.stopPropagation()}>
                    <Typography variant="body2" sx={{ fontWeight: 600, '&:hover': { textDecoration: 'underline' } }}>{p.slug}</Typography>
                  </Link>
                </TableCell>
                <TableCell>{p.title}</TableCell>
                <TableCell>{p.authTier}</TableCell>
                <TableCell align="right">{p.sectionCount}</TableCell>
              </TableRow>
            ))}
          </TableBody></Table>
        );
      },
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

  // ── Export / Import ──────────────────────────────────

  const exportCategoryAsJson = useCallback((cat: CategoryConfig) => {
    // Wrap in a portable format: { table: "<table_name>", data: [...] }
    // This ensures the import endpoint can identify which table to write to.
    const payload = { table: cat.table, data: cat.detail };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cat.key}-data.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportAllAsJson = useCallback(() => {
    const allData: Record<string, unknown> = {};
    for (const cat of categories) {
      allData[cat.table] = cat.detail;
    }
    const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'all-seeded-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }, [categories]);

  const [importing, setImporting] = useState(false);
  const [importingCategory, setImportingCategory] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<string | null>(null);
  const [categoryImportResults, setCategoryImportResults] = useState<Record<string, string | null>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const categoryFileInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleImportJson = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const errors: string[] = [];
      let totalImported = 0;

      // Resolve entries from the uploaded JSON.
      // Supports three formats:
      //   1. Wrapped:  { "table": "knowledge_snippets", "data": [...] }
      //   2. Bulk:     { "knowledge_snippets": [...], "business_review_parts": [...] }
      //   3. Raw:      [...]  (single category array — we can't know the table, so skip)
      let entries: [string, unknown[]][] = [];

      if (parsed && typeof parsed === 'object') {
        if (parsed.table && Array.isArray(parsed.data)) {
          // Format 1: single-category wrapped export
          entries = [[parsed.table, parsed.data]];
        } else {
          // Format 2: bulk export — keys are table names, values are arrays
          entries = Object.entries(parsed).filter(
            (entry): entry is [string, unknown[]] => {
              const key = entry[0] as string;
              // Filter out non-table keys and non-array values
              if (key === 'table' || key === 'data') return false;
              return Array.isArray(entry[1]);
            },
          );
        }
      } else if (Array.isArray(parsed)) {
        // Format 3: raw array — we don't know the table name
        errors.push('Raw array detected. Please use a file exported from the "JSON" button which includes the table name.');
      }

      if (entries.length === 0 && errors.length === 0) {
        errors.push('No importable data found in the JSON file.');
      }

      for (const [table, data] of entries) {
        if (!Array.isArray(data) || data.length === 0) continue;
        try {
          const res = await fetch('/api/config/import-data', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ table, data }),
          });
          const result = await res.json();
          if (result.success) {
            totalImported += result.data.imported;
          } else {
            errors.push(`${table}: ${result.error ?? 'Import failed'}`);
          }
        } catch (err) {
          errors.push(`${table}: ${err instanceof Error ? err.message : 'Request failed'}`);
        }
      }

      if (errors.length > 0) {
        setImportResult(`Imported ${totalImported} rows. Warnings/errors:\n${errors.join('\n')}`);
      } else {
        setImportResult(`Imported ${totalImported} rows successfully.`);
      }
      void fetchDetails();
    } catch (err) {
      setImportResult(`Import failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImporting(false);
    }
  }, [fetchDetails]);

  /** Import a file for a specific category only. */
  const handleCategoryImport = useCallback(async (cat: CategoryConfig, file: File) => {
    setImportingCategory(cat.key);
    setCategoryImportResults((prev) => ({ ...prev, [cat.key]: null }));
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      // Accept either wrapped { table, data } format or raw array
      const table = parsed.table || cat.table;
      const data = parsed.data || (Array.isArray(parsed) ? parsed : null);

      if (!data || !Array.isArray(data) || data.length === 0) {
        setCategoryImportResults((prev) => ({ ...prev, [cat.key]: 'No data found in file' }));
        return;
      }

      const res = await fetch('/api/config/import-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table, data }),
      });
      const result = await res.json();
      if (result.success) {
        setCategoryImportResults((prev) => ({ ...prev, [cat.key]: `Imported ${result.data.imported} rows` }));
        void fetchDetails();
      } else {
        setCategoryImportResults((prev) => ({ ...prev, [cat.key]: result.error ?? 'Import failed' }));
      }
    } catch (err) {
      setCategoryImportResults((prev) => ({ ...prev, [cat.key]: `Error: ${err instanceof Error ? err.message : String(err)}` }));
    } finally {
      setImportingCategory(null);
    }
  }, [fetchDetails]);

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
              {cat.detail.length > 0 ? (
                <Button size="small" variant="text" onClick={(e) => { e.stopPropagation(); exportCategoryAsJson(cat); }} startIcon={<DownloadIcon />} sx={{ minWidth: 0, p: 0.5 }}>
                  JSON
                </Button>
              ) : null}
              <Button
                size="small"
                variant="text"
                component="label"
                disabled={importingCategory === cat.key}
                onClick={(e) => e.stopPropagation()}
                startIcon={importingCategory === cat.key ? <CircularProgress size={14} /> : <UploadFileIcon />}
                sx={{ minWidth: 0, p: 0.5 }}
              >
                {importingCategory === cat.key ? '...' : 'Upload'}
                <input
                  hidden
                  type="file"
                  accept=".json"
                  ref={(el) => { categoryFileInputs.current[cat.key] = el; }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) { void handleCategoryImport(cat, file); }
                    e.target.value = '';
                  }}
                />
              </Button>
              {categoryImportResults[cat.key] ? (
                <Typography variant="caption" sx={{ color: categoryImportResults[cat.key]?.includes('Error') || categoryImportResults[cat.key]?.includes('failed') ? 'error.main' : 'success.main' }}>
                  {categoryImportResults[cat.key]}
                </Typography>
              ) : null}
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 2 }}>
            {cat.renderDetail()}
          </AccordionDetails>
        </Accordion>
      ))}

      <Divider />

      {/* Export / Import bar */}
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={exportAllAsJson} disabled={categories.every((c) => c.detail.length === 0)}>
            Export All as JSON
          </Button>
          <Button size="small" variant="outlined" component="label" startIcon={importing ? <CircularProgress size={16} /> : <UploadFileIcon />} disabled={importing}>
            {importing ? 'Importing...' : 'Upload JSON'}
            <input hidden type="file" accept=".json" ref={fileInputRef} onChange={handleImportJson} />
          </Button>
          {importResult ? (
            <Typography variant="caption" color={importResult.includes('failed') ? 'error' : 'success.main'}>{importResult}</Typography>
          ) : null}
        </Stack>
      </Paper>

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
