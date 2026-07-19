'use client';

import { useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { setActiveTab } from '@/store/ui-slice';
import {
  useDeleteZReportMutation,
  useGetCalendarQuery,
  useGetDetailQuery,
  useGetSchemaQuery,
  useImportMetricsMutation,
  useListMetricsQuery,
  useSaveZReportMutation,
} from '@/store/apis/metrics-api';
import {
  useGetMonthlyActualsQuery,
  useLazyGetMonthlyActualsQuery,
  useSaveMonthlyActualsMutation,
} from '@/store/apis/monthly-actuals-api';
import {
  useParseExpenseTextMutation,
  useParsePosTextMutation,
  useScanExpenseReceiptMutation,
  useScanPosReceiptMutation,
} from '@/store/apis/pos-api';
import { imageToDataUrl } from '@/domain/z-report/receipt-images';
import type { ReceiptImage } from '@/domain/z-report/receipt-images';

type OpsTab = 'day-pos' | 'costs-payroll' | 'fill-missing' | 'recent';
type ActualsSubtab = 'submit' | 'prefill';

const TOUCH_TARGET_SX = { minHeight: 48 };

interface ImportPreviewPayload {
  mode: 'daily' | 'monthly_prorate';
  period: string;
  rows?: Record<string, unknown>[];
  monthly?: Record<string, unknown>;
  summary: string;
}

interface ReceiptImagePayload {
  dataUrl: string;
  mime: string;
  name: string;
  captured_at: string;
}

/** Thumbnail grid of receipt images with per-image delete */
function ReceiptThumbnails({
  images,
  onRemove,
}: {
  images: ReceiptImagePayload[];
  onRemove: (index: number) => void;
}) {
  if (!images.length) return null;
  return (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
      {images.map((img, i) => (
        <Box
          key={`${img.name}-${i}`}
          sx={{
            position: 'relative',
            width: 100,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
            overflow: 'hidden',
            bgcolor: 'action.hover',
          }}
        >
          <img
            src={img.dataUrl}
            alt={img.name}
            style={{ width: '100%', height: 75, objectFit: 'cover', display: 'block' }}
          />
          <Button
            size="small"
            onClick={() => onRemove(i)}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 24,
              width: 24,
              height: 24,
              p: 0,
              borderRadius: '0 0 0 4px',
              bgcolor: 'rgba(0,0,0,0.6)',
              color: 'white',
              fontSize: '0.75rem',
              lineHeight: 1,
              '&:hover': { bgcolor: 'error.main' },
            }}
          >
            ✕
          </Button>
          <Typography
            variant="caption"
            noWrap
            sx={{ display: 'block', px: 0.5, py: 0.25, fontSize: '0.65rem' }}
          >
            {img.name.length > 14 ? `${img.name.slice(0, 12)}…` : img.name}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

interface ZReportField {
  key: string;
  label: string;
  type: 'date' | 'time' | 'text' | 'int' | 'amount' | 'datetime';
  required?: boolean;
}

interface ZReportSection {
  id: string;
  title: string;
  fields: ZReportField[];
}

interface ZReportDepartment {
  id: string;
  label: string;
  shortLabel?: string;
}

interface ZReportSchemaPayload {
  departments?: ZReportDepartment[];
  form_sections?: ZReportSection[];
}

interface MonthlyDepartment {
  id: string;
  label: string;
  shortLabel?: string;
}

interface ManualField {
  key: string;
  label: string;
  type: string;
}

interface MonthlyActualsPayload {
  departments?: MonthlyDepartment[];
  department_detail?: {
    inputs?: Record<string, unknown>;
    section?: { fields?: ManualField[] };
    notes?: string;
  } | null;
  computed_preview?: Record<string, unknown>;
  excel_locked?: boolean;
}

interface CalendarPayload {
  period?: string;
  days_in_month?: number;
  filled?: { date: string; entry_source: string }[];
  missing?: string[];
  manual_count?: number;
  imported_count?: number;
}

interface MetricsRow {
  report_date?: string;
  date?: string;
  department?: string;
  nett_sales?: number;
  total_sales?: number;
  total_covers?: number;
  total_bills?: number;
  avg_bills?: number;
  avg_covers?: number;
  receipt_image_count?: number;
  entry_source?: string;
}

interface MonthlyRecentRow {
  period?: string;
  kind?: string;
  department_label?: string;
  input_count?: number;
  input_total?: number;
  receipt_count?: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function currentPeriod(): string {
  return new Date().toISOString().slice(0, 7);
}

function priorPeriod(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month - 2, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function buildImportPreview(
  period: string,
  rows: Record<string, unknown>[],
): ImportPreviewPayload | null {
  const monthlyRow = rows.find((row) => row.period && !row.report_date && !row.date);
  if (monthlyRow) {
    const monthlyPeriod = String(monthlyRow.period).slice(0, 7) || period;
    const monthly: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(monthlyRow)) {
      if (key !== 'period' && value !== '') monthly[key] = value;
    }
    return {
      mode: 'monthly_prorate',
      period: monthlyPeriod,
      monthly,
      summary: `Monthly prorate for ${monthlyPeriod} across missing days`,
    };
  }

  const dailyRows = rows.filter((row) => {
    const date = String(row.report_date ?? row.date ?? '').slice(0, 10);
    if (!date) return false;
    const hasSales = (row.nett_sales != null && row.nett_sales !== '')
      || (row.total_sales != null && row.total_sales !== '');
    const hasCovers = row.total_covers != null && row.total_covers !== '';
    return hasSales && hasCovers;
  });

  if (!dailyRows.length) return null;

  const inMonth = dailyRows.filter((row) =>
    String(row.report_date ?? row.date).slice(0, 7) === period,
  );
  const useRows = inMonth.length ? inMonth : dailyRows;

  return {
    mode: 'daily',
    period,
    rows: useRows,
    summary: `${useRows.length} daily row(s) for import`,
  };
}

function toNumberOrString(value: string): string | number {
  const trimmed = value.trim();
  if (!trimmed) return '';
  const normalized = trimmed.replace(/,/g, '');
  const numeric = Number(normalized);
  return Number.isFinite(numeric) && /^-?\d+(\.\d+)?$/.test(normalized) ? numeric : trimmed;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function formatIdr(value: unknown): string {
  const number = Number(value ?? 0);
  if (!Number.isFinite(number)) return '-';
  return `IDR ${Math.round(number).toLocaleString('id-ID')}`;
}

async function readReceiptFiles(files: FileList | null): Promise<ReceiptImagePayload[]> {
  const selected = Array.from(files ?? []).slice(0, 3);
  return Promise.all(selected.map((file) => new Promise<ReceiptImagePayload>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      dataUrl: String(reader.result ?? ''),
      mime: file.type || 'image/jpeg',
      name: file.name,
      captured_at: new Date().toISOString(),
    });
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.readAsDataURL(file);
  })));
}

function buildPayload(values: Record<string, unknown>, extra: Record<string, unknown> = {}) {
  const payload: Record<string, unknown> = { ...extra };
  for (const [key, value] of Object.entries(values)) {
    const coerced = typeof value === 'string' ? toNumberOrString(value) : value;
    if (coerced !== '') payload[key] = coerced;
  }
  return payload;
}

function dataFromEnvelope<T>(value: unknown): T {
  return asRecord(value).data as T;
}

function SectionShell({ title, tooltip, children }: { title: string; tooltip?: string; children: ReactNode }) {
  return (
    <Paper elevation={0} sx={{ p: 2.5, border: '1px solid', borderColor: 'divider', bgcolor: '#0f0f14' }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        {title}
        {tooltip ? (
          <Tooltip title={tooltip} arrow>
            <Box component="span" sx={{ cursor: 'help', color: 'text.secondary', fontSize: '0.8rem' }}>ⓘ</Box>
          </Tooltip>
        ) : null}
      </Typography>
      {children}
    </Paper>
  );
}

function PosOcrPanel({
  onParsed,
  onImagesReady,
  onParseComplete,
  resetKey,
}: {
  onParsed: (values: Record<string, string>) => void;
  onImagesReady?: (images: ReceiptImagePayload[]) => void;
  onParseComplete?: () => void;
  resetKey?: number;
}) {
  const [images, setImages] = useState<ReceiptImagePayload[]>([]);
  const [text, setText] = useState('');
  const [scan] = useScanPosReceiptMutation();
  const [parse, parseState] = useParsePosTextMutation();
  const abortRef = useRef<AbortController | null>(null);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; failed: number } | null>(null);

  // Reset on resetKey change
  const prevResetKey = useRef(resetKey);
  if (resetKey !== prevResetKey.current) {
    prevResetKey.current = resetKey;
    if (resetKey !== undefined && resetKey !== 0) {
      setImages([]);
      setText('');
    }
  }

  const handleScan = async () => {
    setScanProgress({ current: 0, total: images.length, failed: 0, status: 'scanning' });
    const results: string[] = [];
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      if (abortRef.current?.signal.aborted) break;
      setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });

      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const resp = await fetch('/api/pos?action=scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [images[i].dataUrl] }),
          signal: controller.signal,
          credentials: 'include',
        });
        if (resp.ok) {
          const payload = await resp.json();
          if (payload.data?.text) results.push(payload.data.text.trim());
        } else {
          failed++;
          setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
        failed++;
        setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });
      }
    }

    if (!abortRef.current?.signal.aborted) {
      setScanProgress({ current: images.length, total: images.length, failed, status: 'processing' });
      await new Promise((r) => setTimeout(r, 80));
      const joined = results.map((r) => r.trim()).join('\n---\n');
      const cleaned = joined.replace(/\n{3,}/g, '\n\n').trim();
      setText(cleaned);
    }
    abortRef.current = null;
    setScanProgress(null);
  };

  const handleStopScan = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanProgress(null);
  };

  const handleParse = async () => {
    const payload = await parse({ text, useAi: true }).unwrap();
    const parsed = asRecord(payload.data);
    onParsed(Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')])));
    // Auto-attach scanned images to verification receipts
    if (onImagesReady && images.length) {
      onImagesReady(images);
    }
    if (onParseComplete) onParseComplete();
  };

  return (
    <SectionShell title="POS OCR Prefill">
      <Stack spacing={2}>
        <Button component="label" variant="outlined">
          Attach POS Receipt Photos
          <input
            hidden
            multiple
            accept="image/*"
            type="file"
            onChange={(event) => {
              void readReceiptFiles(event.target.files).then(setImages);
            }}
          />
          </Button>
          <ReceiptThumbnails
            images={images}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            onClick={handleScan}
            disabled={!images.length || !!scanProgress}
            variant="contained"
          >
            {scanProgress ? `Scanning ${scanProgress.current}/${scanProgress.total}${scanProgress.failed ? ` (${scanProgress.failed} failed)` : ''}${scanProgress.status === 'processing' ? ' — Processing...' : ''}...` : 'Scan'}
          </Button>
          {scanProgress ? (
            <Button onClick={handleStopScan} variant="outlined" color="warning">
              Stop
            </Button>
          ) : null}
          <Button onClick={handleParse} disabled={!text.trim() || parseState.isLoading} variant="outlined">
            {parseState.isLoading ? 'Parsing...' : 'Parse & Prefill'}
          </Button>
        </Stack>
        {scanProgress ? (
          <LinearProgress
            variant="determinate"
            value={Math.round((scanProgress.current / scanProgress.total) * 100)}
          />
        ) : null}
        <TextField
          label="Receipt text"
          value={text}
          onChange={(event) => setText(event.target.value)}
          multiline
          minRows={6}
          fullWidth
        />
      </Stack>
    </SectionShell>
  );
}

function ZReportListView({
  recentRows,
  setZrepDetail,
}: {
  recentRows: MetricsRow[];
  setZrepDetail: (d: { date: string; dept: string }) => void;
}) {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Date</TableCell>
          <TableCell>Dept</TableCell>
          <TableCell>Nett Sales</TableCell>
          <TableCell>Covers</TableCell>
          <TableCell>Receipts</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {recentRows.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} align="center">
              <Typography variant="body2" color="text.secondary">No recent reports.</Typography>
            </TableCell>
          </TableRow>
        ) : (
          recentRows.map((row) => {
            const date = row.report_date ?? row.date ?? '';
            return (
              <TableRow
                key={`${date}-${row.department ?? 'all'}`}
                hover
                sx={{ cursor: 'pointer' }}
                onClick={() => setZrepDetail({ date: String(date), dept: String(row.department ?? 'all_pos') })}
              >
                <TableCell>{date}</TableCell>
                <TableCell>{row.department ?? 'all_pos'}</TableCell>
                <TableCell>{formatIdr(row.nett_sales)}</TableCell>
                <TableCell>{row.total_covers ?? '-'}</TableCell>
                <TableCell>{row.receipt_image_count ?? 0}</TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  );
}

function ZReportCalendarView() {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data: calPayload, isFetching } = useGetCalendarQuery(period);
  const calData = dataFromEnvelope<{ days_in_month?: number; filled?: { date: string; entry_source?: string }[]; missing?: string[] }>(calPayload);

  if (isFetching) return <CircularProgress size={24} />;
  if (!calData) return <Typography color="text.secondary">No calendar data.</Typography>;

  const filledSet = new Set((calData.filled ?? []).map((f) => f.date));
  const days = calData.days_in_month ?? 30;
  const monthLabel = new Date(Number(period.split('-')[0]), Number(period.split('-')[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{monthLabel}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, textAlign: 'center' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <Typography key={d} variant="caption" sx={{ fontWeight: 700 }}>{d}</Typography>
        ))}
        {Array.from({ length: days }, (_, i) => {
          const date = `${period}-${String(i + 1).padStart(2, '0')}`;
          const hasData = filledSet.has(date);
          return (
            <Box
              key={date}
              sx={{
                p: 0.5,
                borderRadius: 0.5,
                bgcolor: hasData ? 'primary.main' : 'action.hover',
                color: hasData ? 'primary.contrastText' : 'text.secondary',
                fontSize: '0.75rem',
                minHeight: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {i + 1}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function ZReportChartView() {
  const now = new Date();
  const [chartYear, setChartYear] = useState(now.getFullYear());
  const [chartMonth, setChartMonth] = useState(now.getMonth() + 1);
  const [chartMetric, setChartMetric] = useState('nett_sales');
  const [chartMetricLabel, setChartMetricLabel] = useState('Nett Sales');

  const from = `${chartYear}-${String(chartMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(chartYear, chartMonth, 0).getDate();
  const to = `${chartYear}-${String(chartMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: chartPayload, isFetching } = useListMetricsQuery({ from, to, limit: 31 });
  const chartRows = (asRecord(chartPayload).rows as MetricsRow[] | undefined) ?? [];

  const chartMetrics: { key: string; label: string; numeric: boolean }[] = [
    { key: 'nett_sales', label: 'Nett Sales', numeric: true },
    { key: 'total_sales', label: 'Total Sales', numeric: true },
    { key: 'total_covers', label: 'Total Covers', numeric: true },
    { key: 'total_bills', label: 'Total Bills', numeric: true },
    { key: 'avg_bills', label: 'Avg Bill', numeric: true },
    { key: 'avg_covers', label: 'Avg Cover', numeric: true },
  ];

  // Aggregate by day
  const byDay: Record<string, number> = {};
  for (const row of chartRows) {
    const date = row.report_date ?? row.date ?? '';
    if (!date) continue;
    const val = Number((row as Record<string, unknown>)[chartMetric] ?? 0);
    byDay[date] = (byDay[date] ?? 0) + val;
  }

  const days = Object.keys(byDay).sort();
  const monthLabel = new Date(chartYear, chartMonth - 1).toLocaleString('default', { month: 'long' });

  const chartData = {
    labels: days.map((d) => d.slice(8)),
    datasets: [{
      label: `${chartMetricLabel} — ${monthLabel}`,
      data: days.map((d) => byDay[d]),
      backgroundColor: 'rgba(144, 202, 249, 0.6)',
      borderColor: 'rgb(144, 202, 249)',
      borderWidth: 1,
    }],
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1.5} sx={{ flexWrap: 'wrap' }}>
        <TextField
          select
          size="small"
          label="Year"
          value={chartYear}
          onChange={(e) => setChartYear(Number(e.target.value))}
          sx={{ minWidth: 100 }}
        >
          {[2025, 2026, 2027].map((y) => (
            <MenuItem key={y} value={y}>{y}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Month"
          value={chartMonth}
          onChange={(e) => setChartMonth(Number(e.target.value))}
          sx={{ minWidth: 120 }}
        >
          {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((m, i) => (
            <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Metric"
          value={chartMetric}
          onChange={(e) => {
            setChartMetric(e.target.value);
            const found = chartMetrics.find((cm) => cm.key === e.target.value);
            if (found) setChartMetricLabel(found.label);
          }}
          sx={{ minWidth: 140 }}
        >
          {chartMetrics.map((cm) => (
            <MenuItem key={cm.key} value={cm.key}>{cm.label}</MenuItem>
          ))}
        </TextField>
      </Stack>

      {isFetching ? (
        <CircularProgress size={24} />
      ) : days.length === 0 ? (
        <Typography color="text.secondary">No data for {monthLabel} {chartYear}.</Typography>
      ) : (
        <Box sx={{ height: 250 }}>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: true } },
              scales: {
                y: {
                  beginAtZero: true,
                  title: { display: true, text: chartMetricLabel },
                },
              },
            }}
          />
        </Box>
      )}
    </Stack>
  );
}

function DayPosTab() {
  const [department, setDepartment] = useState('all_pos');
  const [values, setValues] = useState<Record<string, string>>({ report_date: today() });
  const [receiptImages, setReceiptImages] = useState<ReceiptImagePayload[]>([]);
  const [save, saveState] = useSaveZReportMutation();
  const [resetKey, setResetKey] = useState(0);
  const [expanded, setExpanded] = useState<string>('step1');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'chart'>('list');
  const [zrepDetail, setZrepDetail] = useState<{ date: string; dept: string } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<ReceiptImage | null>(null);
  const { data, isFetching } = useGetSchemaQuery(department);
  const { data: recentPayload } = useListMetricsQuery({ page: 1, limit: 5 });
  const schema = dataFromEnvelope<ZReportSchemaPayload>(data);
  const departments = schema?.departments ?? [];
  const sections = schema?.form_sections ?? [];
  const recentRows = (asRecord(recentPayload).rows as MetricsRow[] | undefined) ?? [];

  const { data: zrepDetailPayload, isFetching: zrepLoading } = useGetDetailQuery(
    { date: zrepDetail?.date ?? '', department: zrepDetail?.dept ?? 'all_pos' },
    { skip: !zrepDetail },
  );
  const zrepDetailData = dataFromEnvelope<Record<string, unknown>>(zrepDetailPayload);
  const zrepImages = (Array.isArray(zrepDetailData?.receipt_images) ? zrepDetailData?.receipt_images : []) as ReceiptImage[];

  const handleChange = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const handleSave = async () => {
    await save(buildPayload(values, {
      department,
      receipt_images: receiptImages,
    })).unwrap();
    setValues({ report_date: today() });
    setReceiptImages([]);
    setResetKey((k) => k + 1);
    setExpanded('step3');
  };

  const handleAccordion = (panel: string) => (_: SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : '');
  };

  return (
    <Box>
      <Accordion expanded={expanded === 'step1'} onChange={handleAccordion('step1')} sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            Step 1: POS OCR Prefill
            <Tooltip title="Scan POS receipt images to extract Z-report data automatically" arrow>
              <Box component="span" sx={{ cursor: 'help', color: 'text.secondary', fontSize: '0.8rem' }}>ⓘ</Box>
            </Tooltip>
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <PosOcrPanel
            resetKey={resetKey}
            onParsed={(parsed) => setValues((current) => ({ ...current, ...parsed }))}
            onImagesReady={(imgs) => setReceiptImages((prev) => {
              const existing = new Set(prev.map((p) => p.dataUrl));
              const newImgs = imgs.filter((img) => !existing.has(img.dataUrl));
              return [...prev, ...newImgs];
            })}
            onParseComplete={() => setExpanded('step2')}
          />
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'step2'} onChange={handleAccordion('step2')} sx={{ mb: 1 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            Step 2: Day POS Upload
            <Tooltip title="Review extracted data, attach receipts, then save the Z-report" arrow>
              <Box component="span" sx={{ cursor: 'help', color: 'text.secondary', fontSize: '0.8rem' }}>ⓘ</Box>
            </Tooltip>
          </Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={2}>
            <TextField
              select
              label="Department"
              value={department}
              onChange={(event) => setDepartment(event.target.value)}
              fullWidth
            >
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={dept.id}>{dept.label}</MenuItem>
              ))}
            </TextField>

            {isFetching ? <CircularProgress size={24} /> : null}
            {sections.map((section) => (
              <Box key={section.id}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>{section.title}</Typography>
                <Grid container spacing={1.5}>
                  {section.fields.map((field) => (
                    <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label={field.label}
                        type={
                          field.type === 'date' ? 'date'
                          : field.type === 'time' ? 'time'
                          : field.type === 'datetime' ? 'text'
                          : field.type === 'text' ? 'text'
                          : 'number'
                        }
                        placeholder={field.type === 'datetime' ? 'DD/MM/YYYY HH:MM:SS' : undefined}
                        value={values[field.key] ?? ''}
                        onChange={(event) => handleChange(field.key, event.target.value)}
                        required={field.required}
                        slotProps={{ inputLabel: { shrink: true } }}
                        fullWidth
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}

            <Button component="label" variant="outlined">
              Attach Verification Receipts
              <input
                hidden
                multiple
                accept="image/*"
                type="file"
                onChange={(event) => {
                  void readReceiptFiles(event.target.files).then(setReceiptImages);
                }}
              />
            </Button>
            <ReceiptThumbnails
              images={receiptImages}
              onRemove={(i) => setReceiptImages((prev) => prev.filter((_, idx) => idx !== i))}
            />

            <Button onClick={handleSave} disabled={saveState.isLoading} variant="contained">
              {saveState.isLoading ? 'Saving...' : 'Save Z-report'}
            </Button>
            {saveState.isSuccess ? <Typography role="status" color="success.main">Z-report saved.</Typography> : null}
          </Stack>
        </AccordionDetails>
      </Accordion>

      <Accordion expanded={expanded === 'step3'} onChange={handleAccordion('step3')}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Stack direction="row" sx={{ width: '100%', alignItems: 'center', justifyContent: 'space-between', pr: 2 }}>
            <Typography sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
              Step 3: Recent Z-reports
              <Tooltip title="Recently saved Z-reports appear here after submission" arrow>
                <Box component="span" sx={{ cursor: 'help', color: 'text.secondary', fontSize: '0.8rem' }}>ⓘ</Box>
              </Tooltip>
            </Typography>
            <Stack direction="row" spacing={0.5} onClick={(e) => e.stopPropagation()}>
              {(['list', 'calendar', 'chart'] as const).map((mode) => (
                <Button
                  key={mode}
                  size="small"
                  variant={viewMode === mode ? 'contained' : 'outlined'}
                  onClick={() => setViewMode(mode)}
                  sx={{ textTransform: 'capitalize', fontSize: '0.75rem', py: 0.25 }}
                >
                  {mode}
                </Button>
              ))}
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails>
          {viewMode === 'list' ? <ZReportListView recentRows={recentRows} setZrepDetail={setZrepDetail} /> : null}
          {viewMode === 'calendar' ? <ZReportCalendarView /> : null}
          {viewMode === 'chart' ? <ZReportChartView /> : null}
        </AccordionDetails>
      </Accordion>

      {/* Z-Report Detail Modal */}
      <Dialog open={!!zrepDetail} onClose={() => setZrepDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Z-Report — {zrepDetail?.date} ({zrepDetail?.dept})</span>
          <IconButton onClick={() => setZrepDetail(null)} size="small">✕</IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {zrepLoading ? (
            <CircularProgress size={24} />
          ) : zrepDetailData ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                {Object.entries(zrepDetailData)
                  .filter(([k]) => !['receipt_images', 'id'].includes(k))
                  .map(([key, value]) => (
                    <Box key={key} sx={{ p: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body2">
                        {key.endsWith('_amount') || key.endsWith('_sales') ? formatIdr(value)
                          : key === 'report_date' || key === 'period_start' || key === 'period_end' ? String(value ?? '-').slice(0, 19)
                          : String(value ?? '-')}
                      </Typography>
                    </Box>
                  ))}
              </Box>
              {zrepImages.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Receipt Images ({zrepImages.length})</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {zrepImages.map((img, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 120,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.8 },
                        }}
                        onClick={() => setFullscreenImage(img)}
                      >
                        <img src={imageToDataUrl(img)} alt={img.name || `receipt-${i}`} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                        <Typography variant="caption" noWrap sx={{ display: 'block', px: 0.5, py: 0.25, fontSize: '0.6rem' }}>
                          {img.name || `Image ${i + 1}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          ) : (
            <Typography color="text.secondary">No data found.</Typography>
          )}
        </DialogContent>
      </Dialog>
      <ImageViewerModal open={!!fullscreenImage} image={fullscreenImage} onClose={() => setFullscreenImage(null)} />
    </Box>
  );
}

function ExpenseOcrPanel({
  department,
  onParsed,
}: {
  department: string;
  onParsed: (inputs: Record<string, string>) => void;
}) {
  const [images, setImages] = useState<ReceiptImagePayload[]>([]);
  const [text, setText] = useState('');
  const [scan] = useScanExpenseReceiptMutation();
  const [parse, parseState] = useParseExpenseTextMutation();
  const abortRef = useRef<AbortController | null>(null);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; failed: number } | null>(null);

  const handleScan = async () => {
    setScanProgress({ current: 0, total: images.length, failed: 0, status: 'scanning' });
    const results: string[] = [];
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      if (abortRef.current?.signal.aborted) break;
      setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });

      try {
        const controller = new AbortController();
        abortRef.current = controller;
        const resp = await fetch('/api/pos?action=expense-scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ images: [images[i].dataUrl] }),
          signal: controller.signal,
          credentials: 'include',
        });
        if (resp.ok) {
          const payload = await resp.json();
          if (payload.data?.text) results.push(payload.data.text.trim());
        } else {
          failed++;
          setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') break;
        failed++;
        setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });
      }
    }

    if (!abortRef.current?.signal.aborted) {
      setScanProgress({ current: images.length, total: images.length, failed, status: 'processing' });
      await new Promise((r) => setTimeout(r, 80));
      const joined = results.map((r) => r.trim()).join('\n---\n');
      const cleaned = joined.replace(/\n{3,}/g, '\n\n').trim();
      setText(cleaned);
    }
    abortRef.current = null;
    setScanProgress(null);
  };

  const handleStopScan = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setScanProgress(null);
  };

  const handleParse = async () => {
    const payload = await parse({ text, department, useAi: true }).unwrap();
    const inputs = asRecord(payload.data?.inputs);
    onParsed(Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, String(value ?? '')])));
  };

  return (
    <SectionShell title="Expense Receipt OCR">
      <Stack spacing={2}>
        <Button component="label" variant="outlined">
          Attach Expense Receipts
          <input
            hidden
            multiple
            accept="image/*"
            type="file"
            onChange={(event) => {
              void readReceiptFiles(event.target.files).then(setImages);
            }}
          />
          </Button>
          <ReceiptThumbnails
            images={images}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              onClick={handleScan}
              disabled={!images.length || !!scanProgress}
              variant="contained"
            >
              {scanProgress ? `Scanning ${scanProgress.current}/${scanProgress.total}${scanProgress.failed ? ` (${scanProgress.failed} failed)` : ''}${scanProgress.status === 'processing' ? ' — Processing...' : ''}...` : 'Scan'}
            </Button>
            {scanProgress ? (
              <Button onClick={handleStopScan} variant="outlined" color="warning">
                Stop
              </Button>
            ) : null}
            <Button onClick={handleParse} disabled={!text.trim() || parseState.isLoading} variant="outlined">
              {parseState.isLoading ? 'Parsing...' : 'Parse & Prefill'}
            </Button>
          </Stack>
          {scanProgress ? (
            <LinearProgress
              variant="determinate"
              value={Math.round((scanProgress.current / scanProgress.total) * 100)}
            />
          ) : null}
          <TextField
            label="Receipt text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            multiline
            minRows={6}
            fullWidth
          />
      </Stack>
    </SectionShell>
  );
}

function CostsPayrollTab() {
  const [period, setPeriod] = useState(currentPeriod());
  const [department, setDepartment] = useState('direct');
  const [actualsSubtab, setActualsSubtab] = useState<ActualsSubtab>('submit');
  const [prefillFrom, setPrefillFrom] = useState(priorPeriod(currentPeriod()));
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [receiptImages, setReceiptImages] = useState<ReceiptImagePayload[]>([]);
  const [notes, setNotes] = useState('');
  const [prefillMessage, setPrefillMessage] = useState<string | null>(null);
  const { data, isFetching } = useGetMonthlyActualsQuery({ period, department });
  const [triggerPrefill, prefillState] = useLazyGetMonthlyActualsQuery();
  const [save, saveState] = useSaveMonthlyActualsMutation();
  const payload = dataFromEnvelope<MonthlyActualsPayload>(data);
  const departments = payload?.departments ?? [];
  const fields = payload?.department_detail?.section?.fields ?? [];

  const mergedInputs = useMemo(() => {
    const existing = asRecord(payload?.department_detail?.inputs);
    return { ...existing, ...inputs };
  }, [inputs, payload]);

  const applyPrefillPayload = (prefillPayload: MonthlyActualsPayload & {
    inputs?: Record<string, unknown>;
    department_detail?: MonthlyActualsPayload['department_detail'];
    prefill?: { prior_label?: string };
  }) => {
    const deptInputs = asRecord(prefillPayload.department_detail?.inputs);
    const monthInputs = asRecord(prefillPayload.inputs);
    const nextInputs = Object.keys(deptInputs).length ? deptInputs : monthInputs;
    setInputs(Object.fromEntries(
      Object.entries(nextInputs).map(([key, value]) => [key, String(value ?? '')]),
    ));
    if (prefillPayload.department_detail?.notes) {
      setNotes(String(prefillPayload.department_detail.notes));
    }
    const label = prefillPayload.prefill?.prior_label ?? 'source month';
    setPrefillMessage(`Prefilled from ${label}. Review values and save.`);
  };

  const handlePrefill = async (scope: 'month' | 'dept') => {
    if (payload?.excel_locked) return;
    if (scope === 'dept' && department === 'all') {
      setPrefillMessage('Select a single cost account for Prefill by Account.');
      return;
    }

    const hasValues = Object.values(mergedInputs).some((value) => String(value).trim());
    const replace = hasValues && globalThis.window.confirm(
      scope === 'month'
        ? 'Replace all cost lines with prefill from source month? Cancel to merge with current values.'
        : 'Replace this account\'s fields with prefill? Cancel to merge.',
    );

    const result = await triggerPrefill({
      period,
      department: scope === 'dept' ? department : undefined,
      prefill: true,
      prefill_from: prefillFrom,
      scope,
      ...(replace ? { prefill_mode: 'replace' } : {}),
    }).unwrap();

    applyPrefillPayload(dataFromEnvelope<MonthlyActualsPayload & {
      inputs?: Record<string, unknown>;
      prefill?: { prior_label?: string };
    }>(result));
  };

  const handleSave = async () => {
    await save({
      period,
      department,
      inputs: buildPayload(mergedInputs),
      receipt_images: receiptImages,
      notes,
    }).unwrap();
    setPrefillMessage(null);
  };

  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12, lg: 7 }}>
        <SectionShell title="Costs & Payroll">
          <Stack spacing={2}>
            <Grid container spacing={1.5}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  label="Period"
                  type="month"
                  value={period}
                  onChange={(event) => {
                    const next = event.target.value;
                    setPeriod(next);
                    setPrefillFrom(priorPeriod(next));
                    setInputs({});
                    setPrefillMessage(null);
                  }}
                  slotProps={{ inputLabel: { shrink: true } }}
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Cost Department"
                  value={department}
                  onChange={(event) => {
                    setDepartment(event.target.value);
                    setInputs({});
                    setPrefillMessage(null);
                  }}
                  fullWidth
                >
                  {departments.map((dept) => (
                    <MenuItem key={dept.id} value={dept.id}>{dept.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>

            <Tabs
              value={actualsSubtab}
              onChange={(_event, value: ActualsSubtab) => setActualsSubtab(value)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab value="submit" label="Submit Cost" />
              <Tab value="prefill" label="Prefill Cost" />
            </Tabs>

            {actualsSubtab === 'prefill' ? (
              <Stack spacing={2}>
                <TextField
                  label="Copy costs from month"
                  type="month"
                  value={prefillFrom}
                  onChange={(event) => setPrefillFrom(event.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }}
                  helperText="Defaults to the month before your target. Pick any month with saved costs."
                  sx={{ maxWidth: 320 }}
                />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                  <Button
                    variant="contained"
                    onClick={() => void handlePrefill('month')}
                    disabled={prefillState.isFetching || payload?.excel_locked}
                    sx={TOUCH_TARGET_SX}
                  >
                    {prefillState.isFetching ? 'Prefilling…' : 'Prefill All Accounts'}
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => void handlePrefill('dept')}
                    disabled={prefillState.isFetching || payload?.excel_locked || department === 'all'}
                    sx={TOUCH_TARGET_SX}
                  >
                    Prefill by Account
                  </Button>
                </Stack>
              </Stack>
            ) : null}

            {isFetching ? <CircularProgress size={24} /> : null}
            {payload?.excel_locked ? (
              <Typography color="warning.main">This month is locked to the source Excel ledger.</Typography>
            ) : null}
            {prefillMessage ? (
              <Typography role="status" color="success.main" variant="body2">{prefillMessage}</Typography>
            ) : null}
            {prefillState.isError ? (
              <Typography role="alert" color="error.main" variant="body2">
                Prefill failed. Check source month and try again.
              </Typography>
            ) : null}

            <Grid container spacing={1.5}>
              {fields.map((field) => (
                <Grid key={field.key} size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label={field.label}
                    type={field.type === 'int' || field.type === 'amount' ? 'number' : 'text'}
                    value={String(mergedInputs[field.key] ?? '')}
                    onChange={(event) => setInputs((current) => ({ ...current, [field.key]: event.target.value }))}
                    fullWidth
                  />
                </Grid>
              ))}
            </Grid>

            {actualsSubtab === 'submit' ? (
              <>
                <TextField
                  label="Notes"
                  value={notes || payload?.department_detail?.notes || ''}
                  onChange={(event) => setNotes(event.target.value)}
                  multiline
                  minRows={2}
                  fullWidth
                />

                <Button component="label" variant="outlined" sx={TOUCH_TARGET_SX}>
                  Attach Cost Receipts
                  <input
                    hidden
                    multiple
                    accept="image/*"
                    type="file"
                    onChange={(event) => {
                      void readReceiptFiles(event.target.files).then(setReceiptImages);
                    }}
                  />
                </Button>
                <ReceiptThumbnails
                  images={receiptImages}
                  onRemove={(i) => setReceiptImages((prev) => prev.filter((_, idx) => idx !== i))}
                />
              </>
            ) : null}

            <Button
              onClick={handleSave}
              disabled={saveState.isLoading || payload?.excel_locked}
              variant="contained"
              sx={TOUCH_TARGET_SX}
            >
              {saveState.isLoading ? 'Saving...' : actualsSubtab === 'prefill' ? 'Save & Sync' : 'Save Monthly Actuals'}
            </Button>
            {saveState.isSuccess ? <Typography role="status" color="success.main">Monthly actuals saved.</Typography> : null}

            {payload?.computed_preview ? (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(payload.computed_preview).slice(0, 6).map(([key, value]) => (
                  <Chip key={key} label={`${key.replaceAll('_', ' ')}: ${formatIdr(value)}`} />
                ))}
              </Stack>
            ) : null}
          </Stack>
        </SectionShell>
      </Grid>
      <Grid size={{ xs: 12, lg: 5 }}>
        {actualsSubtab === 'submit' ? (
          <ExpenseOcrPanel
            department={department}
            onParsed={(parsed) => setInputs((current) => ({ ...current, ...parsed }))}
          />
        ) : (
          <SectionShell title="Prefill Notes">
            <Typography variant="body2" color="text.secondary">
              Prefill copies saved or Excel-sourced costs from another month into the fields on the left.
              Review totals, then save to sync Ops Tracking.
            </Typography>
          </SectionShell>
        )}
      </Grid>
    </Grid>
  );
}

function FillMissingTab() {
  const [period, setPeriod] = useState(currentPeriod());
  const [parsedRows, setParsedRows] = useState<Record<string, unknown>[]>([]);
  const [importPreview, setImportPreview] = useState<ImportPreviewPayload | null>(null);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [monthlyTotals, setMonthlyTotals] = useState<Record<string, string>>({});
  const { data, isFetching } = useGetCalendarQuery(period);
  const calendar = dataFromEnvelope<CalendarPayload>(data);
  const [importMetrics, importState] = useImportMetricsMutation();
  const [deleteZReport, deleteState] = useDeleteZReportMutation();

  const handleXlsx = async (file: File) => {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer);
    const sheet = workbook.Sheets[workbook.SheetNames[0] ?? ''];
    if (!sheet) return;
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    setParsedRows(rows);
    setImportPreview(null);
    setImportMessage('File loaded. Click Preview to validate rows before import.');
  };

  const handlePreview = () => {
    if (!parsedRows.length) {
      setImportMessage('Choose an XLSX file first.');
      setImportPreview(null);
      return;
    }
    const preview = buildImportPreview(period, parsedRows);
    if (!preview) {
      setImportMessage('No importable rows found. Ensure report date, nett sales, and covers are filled.');
      setImportPreview(null);
      return;
    }
    setImportPreview(preview);
    setImportMessage(`Preview: ${preview.summary} (${preview.mode})`);
  };

  const handleRunImport = async () => {
    if (!importPreview) {
      handlePreview();
      return;
    }
    if (!globalThis.window.confirm(`Import ${importPreview.summary}?`)) return;

    if (importPreview.mode === 'monthly_prorate') {
      await importMetrics({
        mode: 'monthly_prorate',
        period: importPreview.period,
        monthly: importPreview.monthly,
        fill_missing_only: true,
      }).unwrap();
    } else {
      await importMetrics({
        mode: 'daily',
        rows: importPreview.rows,
        fill_missing_only: true,
      }).unwrap();
    }

    setImportMessage('Import completed.');
    setImportPreview(null);
    setParsedRows([]);
  };

  const handleExportTemplate = async () => {
    const XLSX = await import('xlsx');
    const rows = calendar?.missing?.map((date) => ({
      report_date: date,
      nett_sales: '',
      total_covers: '',
      total_bills: '',
      gofood_amount: '',
      dine_in_amount: '',
    })) ?? [];
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'missing-days');
    XLSX.writeFile(workbook, `redruby-missing-${period}.xlsx`);
  };

  const previewRows = importPreview?.mode === 'daily'
    ? (importPreview.rows ?? []).slice(0, 12)
    : [];

  return (
    <SectionShell title="Fill Missing Days">
      <Stack spacing={2.5}>
        <TextField
          label="Period"
          type="month"
          value={period}
          onChange={(event) => {
            setPeriod(event.target.value);
            setImportPreview(null);
          }}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ maxWidth: 260 }}
        />
        {isFetching ? <CircularProgress size={24} /> : null}
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Chip label={`Filled: ${calendar?.filled?.length ?? 0}`} />
          <Chip label={`Missing: ${calendar?.missing?.length ?? 0}`} color={(calendar?.missing?.length ?? 0) ? 'warning' : 'success'} />
          <Chip label={`Manual: ${calendar?.manual_count ?? 0}`} />
          <Chip label={`Imported: ${calendar?.imported_count ?? 0}`} />
        </Stack>

        <Typography variant="body2" color="text.secondary">
          Upload a completed template, preview parsed rows, then confirm import to save missing days.
        </Typography>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button component="label" variant="outlined" sx={TOUCH_TARGET_SX}>
            Load XLSX Daily Rows
            <input
              hidden
              accept=".xlsx,.xls,.csv"
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleXlsx(file);
              }}
            />
          </Button>
          <Button onClick={handleExportTemplate} variant="outlined" disabled={!calendar?.missing?.length} sx={TOUCH_TARGET_SX}>
            Export Missing Template
          </Button>
          <Button
            onClick={handlePreview}
            disabled={!parsedRows.length}
            variant="outlined"
            sx={TOUCH_TARGET_SX}
          >
            Preview
          </Button>
          <Button
            onClick={() => void handleRunImport()}
            disabled={!importPreview || importState.isLoading}
            variant="contained"
            sx={TOUCH_TARGET_SX}
          >
            {importState.isLoading ? 'Importing…' : 'Run Import'}
          </Button>
        </Stack>

        {importMessage ? (
          <Typography
            role="status"
            color={importPreview || importMessage.startsWith('Preview:') || importMessage.includes('completed') ? 'success.main' : 'text.secondary'}
            variant="body2"
          >
            {importMessage}
          </Typography>
        ) : null}

        {importPreview ? (
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.02)' }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Import preview — {importPreview.summary}
            </Typography>
            {importPreview.mode === 'monthly_prorate' ? (
              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                {Object.entries(importPreview.monthly ?? {}).map(([key, value]) => (
                  <Chip key={key} label={`${key.replaceAll('_', ' ')}: ${value}`} size="small" />
                ))}
              </Stack>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Date</TableCell>
                    <TableCell>Nett Sales</TableCell>
                    <TableCell>Covers</TableCell>
                    <TableCell>Bills</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {previewRows.map((row, index) => (
                    <TableRow key={`${String(row.report_date ?? row.date)}-${index}`}>
                      <TableCell>{String(row.report_date ?? row.date ?? '').slice(0, 10)}</TableCell>
                      <TableCell>{String(row.nett_sales ?? row.total_sales ?? '')}</TableCell>
                      <TableCell>{String(row.total_covers ?? '')}</TableCell>
                      <TableCell>{String(row.total_bills ?? '')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
            {(importPreview.rows?.length ?? 0) > previewRows.length ? (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Showing {previewRows.length} of {importPreview.rows?.length} rows.
              </Typography>
            ) : null}
          </Paper>
        ) : null}

        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Monthly prorate fallback</Typography>
        <Grid container spacing={1.5}>
          {['nett_sales', 'total_covers', 'total_bills', 'gofood_amount', 'dine_in_amount'].map((key) => (
            <Grid key={key} size={{ xs: 12, sm: 6, md: 4 }}>
              <TextField
                label={key.replaceAll('_', ' ')}
                type="number"
                value={monthlyTotals[key] ?? ''}
                onChange={(event) => setMonthlyTotals((current) => ({ ...current, [key]: event.target.value }))}
                fullWidth
              />
            </Grid>
          ))}
        </Grid>
        <Button
          onClick={() => importMetrics({
            mode: 'monthly_prorate',
            period,
            monthly: buildPayload(monthlyTotals),
            fill_missing_only: true,
          })}
          disabled={importState.isLoading}
          variant="outlined"
          sx={TOUCH_TARGET_SX}
        >
          Prorate Monthly Totals Across Missing Days
        </Button>

        <Divider />
        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Missing dates</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          {(calendar?.missing ?? []).map((date) => <Chip key={date} label={date} size="small" />)}
        </Stack>
        <Button
          color="warning"
          variant="outlined"
          disabled={deleteState.isLoading}
          sx={TOUCH_TARGET_SX}
          onClick={() => {
            if (globalThis.window.confirm(`Delete imported rows for ${period}? Manual entries are preserved.`)) {
              void deleteZReport({ period, scope: 'imported' });
            }
          }}
        >
          Delete Imported Rows for Month
        </Button>
      </Stack>
    </SectionShell>
  );
}

/** Full-screen image viewer overlay */
function ImageViewerModal({
  open,
  image,
  onClose,
}: {
  open: boolean;
  image: ReceiptImage | null;
  onClose: () => void;
}) {
  if (!image) return null;
  const src = imageToDataUrl(image);
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" noWrap sx={{ maxWidth: '80%' }}>{image.name || 'Receipt'}</Typography>
        <IconButton onClick={onClose} size="small">✕</IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, textAlign: 'center', bgcolor: '#000' }}>
        <img src={src} alt={image.name || 'receipt'} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
      </DialogContent>
    </Dialog>
  );
}

function RecentEntries() {
  const { data: metricsPayload } = useListMetricsQuery({ page: 1, limit: 8 });
  const { data: actualsPayload } = useGetMonthlyActualsQuery({ period: currentPeriod(), recent: true, page: 1, limit: 8 });
  const [deleteZReport] = useDeleteZReportMutation();
  const metricsRows = asRecord(metricsPayload).rows as MetricsRow[] | undefined;
  const actualsData = dataFromEnvelope<{ rows?: MonthlyRecentRow[] }>(actualsPayload);

  // Detail modal state
  const [zrepDetail, setZrepDetail] = useState<{ date: string; dept: string } | null>(null);
  const [actualsDetail, setActualsDetail] = useState<{ period: string; dept: string } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<ReceiptImage | null>(null);

  const { data: zrepDetailPayload, isFetching: zrepLoading } = useGetDetailQuery(
    { date: zrepDetail?.date ?? '', department: zrepDetail?.dept ?? 'all_pos' },
    { skip: !zrepDetail },
  );
  const zrepDetailData = dataFromEnvelope<Record<string, unknown>>(zrepDetailPayload);
  const zrepImages = (Array.isArray(zrepDetailData?.receipt_images) ? zrepDetailData?.receipt_images : []) as ReceiptImage[];

  const { data: actualsDetailPayload, isFetching: actualsLoading } = useGetMonthlyActualsQuery(
    { period: actualsDetail?.period ?? '', department: actualsDetail?.dept ?? '' },
    { skip: !actualsDetail },
  );
  const actualsDetailData = dataFromEnvelope<Record<string, unknown>>(actualsDetailPayload);
  const deptDetail = (actualsDetailData?.department_detail ?? actualsDetailData) as Record<string, unknown> | undefined;
  const actualsImages = (Array.isArray(deptDetail?.receipt_images) ? deptDetail!.receipt_images : []) as ReceiptImage[];

  return (
    <>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <SectionShell title="Recent Z-reports">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Dept</TableCell>
                  <TableCell>Nett Sales</TableCell>
                  <TableCell>Covers</TableCell>
                  <TableCell>Receipts</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {(metricsRows ?? []).map((row) => {
                  const date = row.report_date ?? row.date ?? '';
                  return (
                    <TableRow
                      key={`${date}-${row.department ?? 'all'}`}
                      hover
                      sx={{ cursor: 'pointer' }}
                      onClick={() => setZrepDetail({ date: String(date), dept: String(row.department ?? 'all_pos') })}
                    >
                      <TableCell>{date}</TableCell>
                      <TableCell>{row.department ?? 'all_pos'}</TableCell>
                      <TableCell>{formatIdr(row.nett_sales)}</TableCell>
                      <TableCell>{row.total_covers ?? '-'}</TableCell>
                      <TableCell>{row.receipt_image_count ?? 0}</TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (globalThis.window.confirm(`Delete Z-report for ${date}?`)) {
                              void deleteZReport({ report_date: date });
                            }
                          }}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </SectionShell>
        </Grid>
        <Grid size={{ xs: 12, lg: 5 }}>
          <SectionShell title="Recent Actuals">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Period</TableCell>
                  <TableCell>Scope</TableCell>
                  <TableCell>Total</TableCell>
                  <TableCell>Receipts</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {(actualsData?.rows ?? []).map((row, index) => (
                  <TableRow
                    key={`${row.period}-${row.department_label}-${index}`}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setActualsDetail({ period: String(row.period), dept: String(row.department_label ?? row.kind) })}
                  >
                    <TableCell>{row.period}</TableCell>
                    <TableCell>{row.department_label ?? row.kind}</TableCell>
                    <TableCell>{formatIdr(row.input_total)}</TableCell>
                    <TableCell>{row.receipt_count ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionShell>
        </Grid>
      </Grid>

      {/* Z-Report Detail Modal */}
      <Dialog open={!!zrepDetail} onClose={() => setZrepDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Z-Report — {zrepDetail?.date} ({zrepDetail?.dept})</span>
          <IconButton onClick={() => setZrepDetail(null)} size="small">✕</IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {zrepLoading ? (
            <CircularProgress size={24} />
          ) : zrepDetailData ? (
            <Stack spacing={2}>
              {/* Field data */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                {Object.entries(zrepDetailData)
                  .filter(([k]) => !['receipt_images', 'id'].includes(k))
                  .map(([key, value]) => (
                    <Box key={key} sx={{ p: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body2">
                        {key.endsWith('_amount') || key.endsWith('_sales') ? formatIdr(value)
                          : key === 'report_date' || key === 'period_start' || key === 'period_end' ? String(value ?? '-').slice(0, 19)
                          : String(value ?? '-')}
                      </Typography>
                    </Box>
                  ))}
              </Box>
              {/* Receipt images */}
              {zrepImages.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Receipt Images ({zrepImages.length})</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {zrepImages.map((img, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 120,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.8 },
                        }}
                        onClick={() => setFullscreenImage(img)}
                      >
                        <img src={imageToDataUrl(img)} alt={img.name || `receipt-${i}`} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                        <Typography variant="caption" noWrap sx={{ display: 'block', px: 0.5, py: 0.25, fontSize: '0.6rem' }}>
                          {img.name || `Image ${i + 1}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          ) : (
            <Typography color="text.secondary">No data found.</Typography>
          )}
        </DialogContent>
      </Dialog>

      {/* Actuals Detail Modal */}
      <Dialog open={!!actualsDetail} onClose={() => setActualsDetail(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Actuals — {actualsDetail?.period} ({actualsDetail?.dept})</span>
          <IconButton onClick={() => setActualsDetail(null)} size="small">✕</IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {actualsLoading ? (
            <CircularProgress size={24} />
          ) : actualsDetailData ? (
            <Stack spacing={2}>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.5 }}>
                {Object.entries((deptDetail?.inputs ?? {}) as Record<string, unknown>)
                  .filter(([, v]) => v != null && v !== '' && v !== 0)
                  .map(([key, value]) => (
                    <Box key={key} sx={{ p: 0.5 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {key.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="body2">{formatIdr(value)}</Typography>
                    </Box>
                  ))}
              </Box>
              {actualsImages.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Receipt Images ({actualsImages.length})</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
                    {actualsImages.map((img, i) => (
                      <Box
                        key={i}
                        sx={{
                          width: 120,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          '&:hover': { opacity: 0.8 },
                        }}
                        onClick={() => setFullscreenImage(img)}
                      >
                        <img src={imageToDataUrl(img)} alt={img.name || `receipt-${i}`} style={{ width: '100%', height: 90, objectFit: 'cover', display: 'block' }} />
                        <Typography variant="caption" noWrap sx={{ display: 'block', px: 0.5, py: 0.25, fontSize: '0.6rem' }}>
                          {img.name || `Image ${i + 1}`}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              ) : null}
            </Stack>
          ) : (
            <Typography color="text.secondary">No data found.</Typography>
          )}
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Viewer */}
      <ImageViewerModal open={!!fullscreenImage} image={fullscreenImage} onClose={() => setFullscreenImage(null)} />
    </>
  );
}

export function OpsAdminTabs({ initialTab = 'day-pos' }: { initialTab?: OpsTab }) {
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((s) => s.ui.activeTab);
  const tab = (['day-pos', 'costs-payroll', 'fill-missing', 'recent'].includes(activeTab)
    ? activeTab
    : initialTab) as OpsTab;

  const handleTabChange = (_event: SyntheticEvent, value: OpsTab) => {
    dispatch(setActiveTab(value));
  };

  return (
    <Box component="section" sx={{  mx: 'auto', px: 3, py: 4 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
            Ops Admin
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Daily POS, Costs, and Missing Days
          </Typography>
          <Typography variant="body2" color="text.secondary">
            PIN or Google session required. Data writes use the JWT cookie tier, not client-side admin keys.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ 
          position: 'sticky', 
          top: 64, 
          zIndex: 89, 
          borderRadius: 0,
          border: '0px solid', 
          borderColor: 'divider', 
          bgcolor: '#121217',
          backgroundFilter: 'blur(0px)' }}>
     
          <Tabs value={tab} onChange={handleTabChange} variant="scrollable" scrollButtons="auto">
            <Tab value="day-pos" label="Day POS" />
            <Tab value="costs-payroll" label="Costs & Payroll" />
            <Tab value="fill-missing" label="Fill Missing Days" />
            <Tab value="recent" label="Recent Entries" />
          </Tabs>
        </Paper>

        {tab === 'day-pos' ? <DayPosTab /> : null}
        {tab === 'costs-payroll' ? <CostsPayrollTab /> : null}
        {tab === 'fill-missing' ? <FillMissingTab /> : null}
        {tab === 'recent' ? <RecentEntries /> : null}
      </Stack>
    </Box>
  );
}
