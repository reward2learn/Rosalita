'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { MouseEvent, ReactNode, SyntheticEvent, WheelEvent } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
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
import AttachFileIcon from '@mui/icons-material/AttachFile';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import StopIcon from '@mui/icons-material/Stop';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FileDownloadDoneIcon from '@mui/icons-material/FileDownloadDone';
import DeleteIcon from '@mui/icons-material/Delete';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import BarChartIcon from '@mui/icons-material/BarChart';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

let opsChartJsRegistered = false;
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
import { Z_REPORT_FIELD_KEYS } from '@/domain/z-report/z-report-schema';
import { PRORATE_KEYS } from '@/domain/z-report/z-report-service';
import { camelToSnake } from '@/domain/shared/number-utils';

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
  onView,
}: {
  images: ReceiptImagePayload[];
  onRemove: (index: number) => void;
  onView?: (index: number) => void;
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
            cursor: onView ? 'pointer' : 'default',
          }}
          onClick={() => onView?.(i)}
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
  // Normalize camelCase keys → snake_case so the preview accepts either convention
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const snakeKey = camelToSnake(key);
      if (snakeKey !== key && row[snakeKey] === undefined) {
        row[snakeKey] = row[key];
      }
    }
  }
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

/** Modal for cropping a receipt photo before adding it to the list */
function CropModal({
  open,
  imageDataUrl,
  imageName,
  onCrop,
  onSkip,
}: {
  open: boolean;
  imageDataUrl: string;
  imageName: string;
  /** Called with the cropped dataUrl */
  onCrop: (croppedDataUrl: string) => void;
  /** Called to keep the original */
  onSkip: () => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const imageWrapRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);

  // Reset selection when modal opens
  useEffect(() => {
    if (open) {
      setSelection(null);
      setIsDragging(false);
      setDragStart(null);
    }
  }, [open]);

  /** Percentage position relative to the image's rendered size (not the outer container) */
  const getRelativePos = useCallback((clientX: number, clientY: number) => {
    const rect = imageWrapRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    const pos = getRelativePos(e.clientX, e.clientY);
    if (!pos) return;
    setDragStart(pos);
    setIsDragging(true);
    setSelection({ x: pos.x, y: pos.y, w: 0, h: 0 });
  }, [getRelativePos]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStart) return;
    const pos = getRelativePos(e.clientX, e.clientY);
    if (!pos) return;

    const left = Math.min(dragStart.x, pos.x);
    const top = Math.min(dragStart.y, pos.y);
    const right = Math.max(dragStart.x, pos.x);
    const bottom = Math.max(dragStart.y, pos.y);

    setSelection({ x: left, y: top, w: right - left, h: bottom - top });
  }, [isDragging, dragStart, getRelativePos]);

  const finishDrag = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setSelection((prev) => {
      if (prev && (prev.w < 0.02 || prev.h < 0.02)) return null;
      return prev;
    });
  }, []);

  const handleCrop = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const natW = img.naturalWidth;
    const natH = img.naturalHeight;

    let sx: number, sy: number, sw: number, sh: number;
    if (selection) {
      sx = Math.round(selection.x * natW);
      sy = Math.round(selection.y * natH);
      sw = Math.round(selection.w * natW);
      sh = Math.round(selection.h * natH);
      // Clamp to image bounds
      sw = Math.min(sw, natW - sx);
      sh = Math.min(sh, natH - sy);
    } else {
      sx = 0; sy = 0; sw = natW; sh = natH;
    }

    canvas.width = sw;
    canvas.height = sh;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    onCrop(croppedDataUrl);
  }, [selection, onCrop]);

  return (
    <Dialog open={open} maxWidth="lg" fullWidth onClose={onSkip}>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body1" noWrap sx={{ maxWidth: '80%' }}>
          Crop — {imageName}
        </Typography>
        <IconButton onClick={onSkip} size="small">✕</IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0, bgcolor: '#000', overflow: 'hidden' }}>
        <Box
          sx={{
            cursor: 'crosshair',
            userSelect: 'none',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: 300,
          }}
        >
          <Box
            ref={imageWrapRef}
            sx={{ position: 'relative', display: 'inline-block', lineHeight: 0 }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={finishDrag}
            onMouseLeave={finishDrag}
          >
            <img
              ref={imgRef}
              src={imageDataUrl}
              alt={imageName}
              draggable={false}
              style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block' }}
            />
            {/* Crop selection overlay */}
            {selection ? (
              <>
                {/* Shaded areas around selection */}
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: `${selection.y * 100}%`, bgcolor: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(1 - selection.y - selection.h) * 100}%`, bgcolor: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', top: `${selection.y * 100}%`, left: 0, width: `${selection.x * 100}%`, height: `${selection.h * 100}%`, bgcolor: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', top: `${selection.y * 100}%`, right: 0, width: `${(1 - selection.x - selection.w) * 100}%`, height: `${selection.h * 100}%`, bgcolor: 'rgba(0,0,0,0.55)', pointerEvents: 'none' }} />
                {/* Selection border */}
                <Box sx={{ position: 'absolute', top: `${selection.y * 100}%`, left: `${selection.x * 100}%`, width: `${selection.w * 100}%`, height: `${selection.h * 100}%`, border: '2px solid #fff', boxShadow: '0 0 0 1px rgba(0,0,0,0.3)', pointerEvents: 'none' }} />
                {/* Corner handles */}
                <Box sx={{ position: 'absolute', top: `calc(${selection.y * 100}% - 6px)`, left: `calc(${selection.x * 100}% - 6px)`, width: 12, height: 12, border: '2px solid #fff', borderRadius: '50%', bgcolor: 'primary.main', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', top: `calc(${selection.y * 100}% - 6px)`, right: `calc(${(1 - selection.x - selection.w) * 100}% - 6px)`, width: 12, height: 12, border: '2px solid #fff', borderRadius: '50%', bgcolor: 'primary.main', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', bottom: `calc(${(1 - selection.y - selection.h) * 100}% - 6px)`, left: `calc(${selection.x * 100}% - 6px)`, width: 12, height: 12, border: '2px solid #fff', borderRadius: '50%', bgcolor: 'primary.main', pointerEvents: 'none' }} />
                <Box sx={{ position: 'absolute', bottom: `calc(${(1 - selection.y - selection.h) * 100}% - 6px)`, right: `calc(${(1 - selection.x - selection.w) * 100}% - 6px)`, width: 12, height: 12, border: '2px solid #fff', borderRadius: '50%', bgcolor: 'primary.main', pointerEvents: 'none' }} />
              </>
            ) : (
              <Typography
                sx={{
                  position: 'absolute',
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  color: 'white',
                  bgcolor: 'rgba(0,0,0,0.6)',
                  px: 2,
                  py: 0.75,
                  borderRadius: 1,
                  fontSize: '0.85rem',
                  pointerEvents: 'none',
                }}
              >
                Click and drag to select crop area
              </Typography>
            )}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onSkip} color="inherit">Use Original</Button>
        <Button onClick={handleCrop} variant="contained" startIcon={<AutoFixHighIcon />}>
          Crop &amp; Confirm
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export interface PosOcrHandle {
  triggerParse: () => Promise<boolean>;
}

const PosOcrPanel = forwardRef<PosOcrHandle, {
  onParsed: (values: Record<string, string>) => void;
  onImagesReady?: (images: ReceiptImagePayload[]) => void;
  onParseComplete?: () => void;
  resetKey?: number;
}>(({
  onParsed,
  onImagesReady,
  onParseComplete,
  resetKey,
}, ref) => {
  const [images, setImages] = useState<ReceiptImagePayload[]>([]);
  const [text, setText] = useState('');
  const [scanPosReceipt] = useScanPosReceiptMutation();
  const [parse] = useParsePosTextMutation();
  const abortRef = useRef<AbortController | null>(null);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; failed: number; status?: string } | null>(null);

  // Crop modal state
  const [cropTarget, setCropTarget] = useState<{ dataUrl: string; name: string } | null>(null);
  const cropQueueRef = useRef<ReceiptImagePayload[]>([]);
  // Image viewer state
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  // Reset on resetKey change
  const prevResetKey = useRef(resetKey);
  if (resetKey !== prevResetKey.current) {
    prevResetKey.current = resetKey;
    if (resetKey !== undefined && resetKey !== 0) {
      setImages([]);
      setText('');
      cropQueueRef.current = [];
      setCropTarget(null);
    }
  }

  /** Open crop modal for the next file in the queue, or flush the queue */
  const processNextInQueue = useCallback(() => {
    const next = cropQueueRef.current.shift();
    if (next) {
      setCropTarget({ dataUrl: next.dataUrl, name: next.name });
    } else {
      setCropTarget(null);
    }
  }, []);

  /** Called when user confirms a crop — replace the cropped image into images */
  const handleCropConfirm = useCallback((croppedDataUrl: string) => {
    const target = cropTarget;
    if (!target) return;
    setImages((prev) => [...prev, {
      dataUrl: croppedDataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processNextInQueue();
  }, [cropTarget, processNextInQueue]);

  /** Called when user skips crop — use original image */
  const handleCropSkip = useCallback(() => {
    const target = cropTarget;
    if (!target) return;
    setImages((prev) => [...prev, {
      dataUrl: target.dataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processNextInQueue();
  }, [cropTarget, processNextInQueue]);

  const handleScan = async () => {
    setScanProgress({ current: 0, total: images.length, failed: 0, status: 'scanning' });
    const results: string[] = [];
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      if (abortRef.current?.signal.aborted) break;
      setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });

      try {
        abortRef.current = new AbortController();
        const result = await scanPosReceipt({ images: [images[i].dataUrl] }).unwrap();
        if (result.data?.text) results.push(result.data.text.trim());
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
    if (!text.trim()) return false;
    try {
      const payload = await parse({ text, useAi: true }).unwrap();
      const parsed = asRecord(payload.data);
      onParsed(Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value ?? '')])));
      // Auto-attach scanned images to verification receipts
      if (onImagesReady && images.length) {
        onImagesReady(images);
      }
      if (onParseComplete) onParseComplete();
      return true;
    } catch {
      return false;
    }
  };

  useImperativeHandle(ref, () => ({
    triggerParse: handleParse,
  }));

  return (
    <SectionShell title="POS OCR Prefill">
      <Stack spacing={2}>
        <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
          Attach POS Receipt Photos
          <input
            hidden
            multiple
            accept="image/*"
            type="file"
            onChange={async (event) => {
              const files = await readReceiptFiles(event.target.files);
              // Clear the input so re-selecting the same file triggers onChange
              event.target.value = '';
              if (!files.length) return;
              // Enqueue all new files and process one at a time via crop modal
              cropQueueRef.current.push(...files);
              processNextInQueue();
            }}
          />
          </Button>
          <ReceiptThumbnails
            images={images}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
            onView={(i) => setViewIndex(i)}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <Button
            onClick={handleScan}
            disabled={!images.length || !!scanProgress}
            variant="contained"
            startIcon={<PhotoCameraIcon />}
          >
            {scanProgress ? `Scanning ${scanProgress.current}/${scanProgress.total}${scanProgress.failed ? ` (${scanProgress.failed} failed)` : ''}${scanProgress.status === 'processing' ? ' — Processing...' : ''}...` : 'Scan'}
          </Button>
          {scanProgress ? (
            <Button onClick={handleStopScan} variant="outlined" color="warning" startIcon={<StopIcon />}>
              Stop
            </Button>
          ) : null}
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
      {/* Full-size image viewer with zoom */}
      <ZoomableViewer
        open={viewIndex !== null}
        imageDataUrl={viewIndex !== null ? images[viewIndex].dataUrl : ''}
        imageName={viewIndex !== null ? images[viewIndex].name : ''}
        onClose={() => setViewIndex(null)}
      />
      <CropModal
        open={!!cropTarget}
        imageDataUrl={cropTarget?.dataUrl ?? ''}
        imageName={cropTarget?.name ?? ''}
        onCrop={handleCropConfirm}
        onSkip={handleCropSkip}
      />
    </SectionShell>
  );
});

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

function ZReportCalendarView({ onDayClick }: { onDayClick?: (date: string) => void }) {
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
                cursor: hasData && onDayClick ? 'pointer' : 'default',
                '&:hover': hasData && onDayClick ? { opacity: 0.8 } : undefined,
              }}
              onClick={() => hasData && onDayClick?.(date)}
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
  const [chartMetrics, setChartMetrics] = useState<string[]>(['nett_sales']);

  useEffect(() => {
    if (!opsChartJsRegistered) {
      ChartJS.register(CategoryScale, LinearScale, BarElement, ChartTooltip, Legend);
      opsChartJsRegistered = true;
    }
  }, []);

  const from = `${chartYear}-${String(chartMonth).padStart(2, '0')}-01`;
  const lastDay = new Date(chartYear, chartMonth, 0).getDate();
  const to = `${chartYear}-${String(chartMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data: chartPayload, isFetching } = useListMetricsQuery({ from, to, limit: 31 });
  const chartRows = (asRecord(chartPayload).rows as MetricsRow[] | undefined) ?? [];

  // All available numeric metrics from the data
  const availableMetrics: { key: string; label: string }[] = [
    { key: 'nett_sales', label: 'Nett Sales' },
    { key: 'total_sales', label: 'Total Sales' },
    { key: 'total_covers', label: 'Total Covers' },
    { key: 'total_bills', label: 'Total Bills' },
    { key: 'avg_bills', label: 'Avg Bill' },
    { key: 'avg_covers', label: 'Avg Cover' },
    { key: 'estimated_sales', label: 'Estimated Sales' },
    { key: 'item_sales_amount', label: 'Item Sales Amount' },
    { key: 'item_discount_amount', label: 'Item Discount Amount' },
    { key: 'bill_discount_amount', label: 'Bill Discount Amount' },
    { key: 'tax_10_amount', label: 'Tax 10%' },
    { key: 'service_7_amount', label: 'Service 7%' },
    { key: 'tot_collection_amount', label: 'Total Collection' },
    { key: 'cash_amount', label: 'Cash Amount' },
    { key: 'bca_amount', label: 'BCA Amount' },
    { key: 'gojek_pay_amount', label: 'Gojek Pay Amount' },
    { key: 'mandiri_amount', label: 'Mandiri Amount' },
    { key: 'group_beverage_amount', label: 'Group Beverage Amount' },
    { key: 'group_food_amount', label: 'Group Food Amount' },
    { key: 'group_total_amount', label: 'Group Total Amount' },
    { key: 'dine_in_amount', label: 'Dine In Amount' },
    { key: 'gofood_amount', label: 'GoFood Amount' },
    { key: 'total_ctgry_amount', label: 'Total Category Amount' },
    { key: 'bill_disc_20_amount', label: 'Bill Disc 20% Amount' },
    { key: 'total_item_discount_amount', label: 'Total Item Discount Amount' },
  ];
  const selectedMetricOptions = availableMetrics.filter((m) => chartMetrics.includes(m.key));

  // Aggregate by day for each selected metric
  const byDay: Record<string, Record<string, number>> = {};
  for (const row of chartRows) {
    const date = row.report_date ?? row.date ?? '';
    if (!date) continue;
    if (!byDay[date]) byDay[date] = {};
    for (const metric of chartMetrics) {
      const val = Number((row as Record<string, unknown>)[metric] ?? 0);
      byDay[date][metric] = (byDay[date][metric] ?? 0) + val;
    }
  }

  const days = Array.from({ length: lastDay }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return `${chartYear}-${String(chartMonth).padStart(2, '0')}-${day}`;
  });

  const datasets = chartMetrics.map((metric, idx) => {
    const colors = [
      'rgba(144, 202, 249, 0.6)',
      'rgba(255, 167, 38, 0.6)',
      'rgba(102, 187, 106, 0.6)',
      'rgba(239, 83, 80, 0.6)',
      'rgba(171, 71, 188, 0.6)',
      'rgba(255, 235, 59, 0.6)',
    ];
    const borderColors = [
      'rgb(144, 202, 249)',
      'rgb(255, 167, 38)',
      'rgb(102, 187, 106)',
      'rgb(239, 83, 80)',
      'rgb(171, 71, 188)',
      'rgb(255, 235, 59)',
    ];
    const metricInfo = availableMetrics.find((m) => m.key === metric);
    return {
      label: `${metricInfo?.label || metric} — ${new Date(chartYear, chartMonth - 1).toLocaleString('default', { month: 'long' })}`,
      data: days.map((d) => byDay[d]?.[metric] ?? 0),
      backgroundColor: colors[idx % colors.length],
      borderColor: borderColors[idx % borderColors.length],
      borderWidth: 1,
      yAxisID: idx === 0 ? 'y' : 'y1',
    };
  });

  const chartData = {
    labels: days.map((d) => d),
    datasets,
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
        <Autocomplete
          multiple
          size="small"
          options={availableMetrics}
          getOptionLabel={(option) => option.label}
          isOptionEqualToValue={(a, b) => a.key === b.key}
          value={selectedMetricOptions}
          onChange={(_, selected) => {
            setChartMetrics(selected.map((m) => m.key));
          }}
          renderInput={(params) => (
            <TextField {...params} label="Metrics" placeholder="Select metrics..." />
          )}
          sx={{ minWidth: 220, flex: 1 }}
        />
      </Stack>

      {isFetching ? (
        <CircularProgress size={24} />
      ) : days.length === 0 ? (
        <Typography color="text.secondary">No data for {new Date(chartYear, chartMonth - 1).toLocaleString('default', { month: 'long' })} {chartYear}.</Typography>
      ) : (
        <Box sx={{ height: 280 }}>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: 'index' as const, intersect: false },
              plugins: {
                legend: { display: true, position: 'top' as const },
                tooltip: {
                  callbacks: {
                    label: (ctx) => `${ctx.dataset.label}: ${formatIdr(ctx.raw)}`,
                  },
                },
              },
              scales: {
                x: {
                  title: { display: true, text: 'Date (YYYY-MM-DD)' },
                  ticks: {
                    autoSkip: false,
                    maxRotation: 90,
                    minRotation: 45,
                    font: { size: 10 },
                  },
                },
                y: {
                  type: 'linear' as const,
                  position: 'left' as const,
                  beginAtZero: true,
                  title: { display: true, text: 'Amount (IDR)' },
                },
                y1: {
                  type: 'linear' as const,
                  position: 'right' as const,
                  grid: { drawOnChartArea: false },
                  title: { display: true, text: 'Count' },
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
  const posOcrRef = useRef<PosOcrHandle>(null);
  const [expanded, setExpanded] = useState<string>('step1');
  const [isParsing, setIsParsing] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'chart'>('list');
  const [zrepDetail, setZrepDetail] = useState<{ date: string; dept: string } | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<ReceiptImage | null>(null);
  const [viewStep2Img, setViewStep2Img] = useState<{ dataUrl: string; name: string } | null>(null);
  const [cropStep2, setCropStep2] = useState<{ dataUrl: string; name: string } | null>(null);
  const cropStep2Ref = useRef<ReceiptImagePayload[]>([]);
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
    if (errors.has(key) && value.trim()) {
      setErrors((prev) => { const next = new Set(prev); next.delete(key); return next; });
    }
  };

  const validateForm = (): boolean => {
    const missing = new Set<string>();
    for (const section of sections) {
      for (const field of section.fields) {
        if (field.required && !values[field.key]?.trim()) {
          missing.add(field.key);
        }
      }
    }
    // Also check net_sales and total_covers specifically
    if (!values['nett_sales']?.trim() && !values['total_sales']?.trim()) {
      missing.add('nett_sales');
    }
    if (!values['total_covers']?.trim()) {
      missing.add('total_covers');
    }
    setErrors(missing);
    return missing.size === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;
    await save(buildPayload(values, {
      department,
      receipt_images: receiptImages,
    })).unwrap();
    setValues({ report_date: today() });
    setReceiptImages([]);
    setErrors(new Set());
    setResetKey((k) => k + 1);
    setExpanded('step3');
  };

  const handleAccordion = (panel: string) => (_: SyntheticEvent, isExpanded: boolean) => {
    setExpanded(isExpanded ? panel : '');
  };

  // --- Step 2 image crop handlers ---
  const processStep2CropQueue = useCallback(() => {
    const next = cropStep2Ref.current.shift();
    if (next) {
      setCropStep2({ dataUrl: next.dataUrl, name: next.name });
    } else {
      setCropStep2(null);
    }
  }, []);

  const handleStep2CropConfirm = useCallback((croppedDataUrl: string) => {
    const target = cropStep2;
    if (!target) return;
    setReceiptImages((prev) => [...prev, {
      dataUrl: croppedDataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processStep2CropQueue();
  }, [cropStep2, processStep2CropQueue]);

  const handleStep2CropSkip = useCallback(() => {
    const target = cropStep2;
    if (!target) return;
    setReceiptImages((prev) => [...prev, {
      dataUrl: target.dataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processStep2CropQueue();
  }, [cropStep2, processStep2CropQueue]);

  return (
    <Box sx={{ pb: 9 }}>
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
            ref={posOcrRef}
            resetKey={resetKey}
            onParsed={(parsed) => setValues((current) => ({ ...current, ...parsed }))}
            onImagesReady={(imgs) => setReceiptImages((prev) => {
              const existing = new Set(prev.map((p) => p.dataUrl));
              const newImgs = imgs.filter((img) => !existing.has(img.dataUrl));
              return [...prev, ...newImgs];
            })}
            onParseComplete={() => setExpanded('step2')}
          />
          <Box sx={{ position: 'sticky', bottom: 20, pt: 1, zIndex: 1 }}>
            <Button
              variant="contained"
              fullWidth
              disabled={isParsing}
              onClick={async () => {
                setIsParsing(true);
                try {
                  await posOcrRef.current?.triggerParse();
                } finally {
                  setIsParsing(false);
                }
              }}
              startIcon={isParsing ? <CircularProgress size={20} color="inherit" /> : <AutoFixHighIcon />}
            >
              {isParsing ? 'Parsing...' : 'Parse & Prefill'}
            </Button>
          </Box>
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
                        error={errors.has(field.key)}
                        helperText={errors.has(field.key) ? 'Required' : undefined}
                        slotProps={{ inputLabel: { shrink: true } }}
                        sx={{
                          '& input[type="date"]::-webkit-calendar-picker-indicator': {
                            filter: 'invert(1)',
                          },
                        }}
                        fullWidth
                      />
                    </Grid>
                  ))}
                </Grid>
              </Box>
            ))}

            <Button
              component="label"
              variant="outlined"
              startIcon={<AttachFileIcon />}
              sx={{
                position: 'sticky',
                bottom: 66,
                background: '#0f0f14',
                zIndex: 99,
              }}
            >
              Attach Verification Receipts
              <input
                hidden
                multiple
                accept="image/*"
                type="file"
                onChange={async (event) => {
                  const files = await readReceiptFiles(event.target.files);
                  event.target.value = '';
                  if (!files.length) return;
                  cropStep2Ref.current.push(...files);
                  processStep2CropQueue();
                }}
              />
            </Button>
            <ReceiptThumbnails
              images={receiptImages}
              onRemove={(i) => setReceiptImages((prev) => prev.filter((_, idx) => idx !== i))}
              onView={(i) => setViewStep2Img({ dataUrl: receiptImages[i].dataUrl, name: receiptImages[i].name })}
            />

            {errors.size > 0 ? (
              <Typography color="error" variant="body2">
                Please fill in all required fields highlighted below.
              </Typography>
            ) : null}

            <Box sx={{ position: 'sticky', bottom: 20, pt: 1, zIndex: 1 }}>
              <Button
                variant="contained"
                fullWidth
                onClick={handleSave}
                disabled={saveState.isLoading}
                startIcon={<SaveIcon />}
                sx={{
                  position: 'sticky',
                  bottom: 18,
                  zIndex: 99,
                }}
              >
                {saveState.isLoading ? 'Saving...' : 'Save Z-report'}
              </Button>
            </Box>
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
                  startIcon={mode === 'list' ? <ViewListIcon /> : mode === 'calendar' ? <CalendarMonthIcon /> : <BarChartIcon />}
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
          {viewMode === 'calendar' ? (
            <ZReportCalendarView
              onDayClick={(date) => setZrepDetail({ date, dept: 'all_pos' })}
            />
          ) : null}
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
      <ZoomableViewer
        open={!!viewStep2Img}
        imageDataUrl={viewStep2Img?.dataUrl ?? ''}
        imageName={viewStep2Img?.name ?? ''}
        onClose={() => setViewStep2Img(null)}
      />
      <CropModal
        open={!!cropStep2}
        imageDataUrl={cropStep2?.dataUrl ?? ''}
        imageName={cropStep2?.name ?? ''}
        onCrop={handleStep2CropConfirm}
        onSkip={handleStep2CropSkip}
      />
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
  const [scanExpenseReceipt] = useScanExpenseReceiptMutation();
  const [parse, parseState] = useParseExpenseTextMutation();
  const abortRef = useRef<AbortController | null>(null);
  const [scanProgress, setScanProgress] = useState<{ current: number; total: number; failed: number; status?: string } | null>(null);
  const [viewExpenseImg, setViewExpenseImg] = useState<{ dataUrl: string; name: string } | null>(null);
  const [cropExpense, setCropExpense] = useState<{ dataUrl: string; name: string } | null>(null);
  const cropExpenseRef = useRef<ReceiptImagePayload[]>([]);

  const processExpenseCropQueue = useCallback(() => {
    const next = cropExpenseRef.current.shift();
    if (next) {
      setCropExpense({ dataUrl: next.dataUrl, name: next.name });
    } else {
      setCropExpense(null);
    }
  }, []);

  const handleExpenseCropConfirm = useCallback((croppedDataUrl: string) => {
    const target = cropExpense;
    if (!target) return;
    setImages((prev) => [...prev, {
      dataUrl: croppedDataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processExpenseCropQueue();
  }, [cropExpense, processExpenseCropQueue]);

  const handleExpenseCropSkip = useCallback(() => {
    const target = cropExpense;
    if (!target) return;
    setImages((prev) => [...prev, {
      dataUrl: target.dataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processExpenseCropQueue();
  }, [cropExpense, processExpenseCropQueue]);

  const handleScan = async () => {
    setScanProgress({ current: 0, total: images.length, failed: 0, status: 'scanning' });
    const results: string[] = [];
    let failed = 0;

    for (let i = 0; i < images.length; i++) {
      if (abortRef.current?.signal.aborted) break;
      setScanProgress({ current: i + 1, total: images.length, failed, status: 'scanning' });

      try {
        abortRef.current = new AbortController();
        const result = await scanExpenseReceipt({ images: [images[i].dataUrl] }).unwrap();
        if (result.data?.text) results.push(result.data.text.trim());
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
        <Button component="label" variant="outlined" startIcon={<AttachFileIcon />}>
          Attach Expense Receipts
          <input
            hidden
            multiple
            accept="image/*"
            type="file"
            onChange={async (event) => {
              const files = await readReceiptFiles(event.target.files);
              event.target.value = '';
              if (!files.length) return;
              cropExpenseRef.current.push(...files);
              processExpenseCropQueue();
            }}
          />
          </Button>
          <ReceiptThumbnails
            images={images}
            onRemove={(i) => setImages((prev) => prev.filter((_, idx) => idx !== i))}
            onView={(i) => setViewExpenseImg({ dataUrl: images[i].dataUrl, name: images[i].name })}
          />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Button
              onClick={handleScan}
              disabled={!images.length || !!scanProgress}
              variant="contained"
              startIcon={<PhotoCameraIcon />}
            >
              {scanProgress ? `Scanning ${scanProgress.current}/${scanProgress.total}${scanProgress.failed ? ` (${scanProgress.failed} failed)` : ''}${scanProgress.status === 'processing' ? ' — Processing...' : ''}...` : 'Scan'}
            </Button>
            {scanProgress ? (
              <Button onClick={handleStopScan} variant="outlined" color="warning" startIcon={<StopIcon />}>
                Stop
              </Button>
            ) : null}
            <Button
              onClick={handleParse}
              disabled={!text.trim() || parseState.isLoading}
              variant="outlined"
              startIcon={parseState.isLoading ? <CircularProgress size={18} /> : <AutoFixHighIcon />}
            >
              PARSE &amp; PREFILL
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
      <ZoomableViewer
        open={!!viewExpenseImg}
        imageDataUrl={viewExpenseImg?.dataUrl ?? ''}
        imageName={viewExpenseImg?.name ?? ''}
        onClose={() => setViewExpenseImg(null)}
      />
      <CropModal
        open={!!cropExpense}
        imageDataUrl={cropExpense?.dataUrl ?? ''}
        imageName={cropExpense?.name ?? ''}
        onCrop={handleExpenseCropConfirm}
        onSkip={handleExpenseCropSkip}
      />
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
  const [viewCostsImg, setViewCostsImg] = useState<{ dataUrl: string; name: string } | null>(null);
  const [cropCosts, setCropCosts] = useState<{ dataUrl: string; name: string } | null>(null);
  const cropCostsRef = useRef<ReceiptImagePayload[]>([]);
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

  // --- Costs crop handlers ---
  const processCostsCropQueue = useCallback(() => {
    const next = cropCostsRef.current.shift();
    if (next) {
      setCropCosts({ dataUrl: next.dataUrl, name: next.name });
    } else {
      setCropCosts(null);
    }
  }, []);

  const handleCostsCropConfirm = useCallback((croppedDataUrl: string) => {
    const target = cropCosts;
    if (!target) return;
    setReceiptImages((prev) => [...prev, {
      dataUrl: croppedDataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processCostsCropQueue();
  }, [cropCosts, processCostsCropQueue]);

  const handleCostsCropSkip = useCallback(() => {
    const target = cropCosts;
    if (!target) return;
    setReceiptImages((prev) => [...prev, {
      dataUrl: target.dataUrl,
      mime: 'image/jpeg',
      name: target.name,
      captured_at: new Date().toISOString(),
    }]);
    processCostsCropQueue();
  }, [cropCosts, processCostsCropQueue]);

  return (
    <>
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
                  <MenuItem value="all">All Accounts</MenuItem>
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
                  {department === 'all' ? (
                    <Button
                      variant="contained"
                      onClick={() => void handlePrefill('month')}
                      disabled={prefillState.isFetching || payload?.excel_locked}
                      startIcon={<ContentCopyIcon />}
                      sx={TOUCH_TARGET_SX}
                    >
                      {prefillState.isFetching ? 'Prefilling…' : 'PREFILL ALL ACCOUNTS'}
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      onClick={() => void handlePrefill('dept')}
                      disabled={prefillState.isFetching || payload?.excel_locked}
                      startIcon={<ContentCopyIcon />}
                      sx={TOUCH_TARGET_SX}
                    >
                      PREFILL BY ACCOUNT
                    </Button>
                  )}
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

                <Button component="label" variant="outlined" startIcon={<AttachFileIcon />} sx={TOUCH_TARGET_SX}>
                  Attach Cost Receipts
                  <input
                    hidden
                    multiple
                    accept="image/*"
                    type="file"
                    onChange={async (event) => {
                      const files = await readReceiptFiles(event.target.files);
                      event.target.value = '';
                      if (!files.length) return;
                      cropCostsRef.current.push(...files);
                      processCostsCropQueue();
                    }}
                  />
                </Button>
                <ReceiptThumbnails
                  images={receiptImages}
                  onRemove={(i) => setReceiptImages((prev) => prev.filter((_, idx) => idx !== i))}
                  onView={(i) => setViewCostsImg({ dataUrl: receiptImages[i].dataUrl, name: receiptImages[i].name })}
                />
              </>
            ) : null}

            <Button
              onClick={handleSave}
              disabled={saveState.isLoading || payload?.excel_locked}
              variant="contained"
              startIcon={<SaveIcon />}
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
      <ZoomableViewer
        open={!!viewCostsImg}
        imageDataUrl={viewCostsImg?.dataUrl ?? ''}
        imageName={viewCostsImg?.name ?? ''}
        onClose={() => setViewCostsImg(null)}
      />
      <CropModal
        open={!!cropCosts}
        imageDataUrl={cropCosts?.dataUrl ?? ''}
        imageName={cropCosts?.name ?? ''}
        onCrop={handleCostsCropConfirm}
        onSkip={handleCostsCropSkip}
      />
    </>
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
    const TEMPLATE_KEYS = [...Z_REPORT_FIELD_KEYS, 'department', 'raw_text'];
    const emptyRow = Object.fromEntries(TEMPLATE_KEYS.map((k) => [k, '']));
    const rows = (calendar?.missing ?? []).map((date) => ({
      ...emptyRow,
      report_date: date,
      department: 'all_pos',
    }));
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
          <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={TOUCH_TARGET_SX}>
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
          <Button onClick={handleExportTemplate} variant="outlined" disabled={!calendar?.missing?.length} startIcon={<DownloadIcon />} sx={TOUCH_TARGET_SX}>
            Export Missing Template
          </Button>
          <Button
            onClick={handlePreview}
            disabled={!parsedRows.length}
            variant="outlined"
            startIcon={<VisibilityIcon />}
            sx={TOUCH_TARGET_SX}
          >
            Preview
          </Button>
          <Button
            onClick={() => void handleRunImport()}
            disabled={!importPreview || importState.isLoading}
            variant="contained"
            startIcon={<FileDownloadDoneIcon />}
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
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Enter monthly totals for any numeric fields below. Values are split evenly across missing days.
        </Typography>
        <Grid container spacing={1.5}>
          {/* Always-visible core fields */}
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
        <Accordion sx={{ mt: 1 }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="body2">All prorate fields ({PRORATE_KEYS.length})</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={1.5}>
              {PRORATE_KEYS.filter((k) => !['nett_sales', 'total_covers', 'total_bills', 'gofood_amount', 'dine_in_amount'].includes(k)).map((key) => (
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
          </AccordionDetails>
        </Accordion>
        <Button
          onClick={() => importMetrics({
            mode: 'monthly_prorate',
            period,
            monthly: buildPayload(monthlyTotals),
            fill_missing_only: true,
          })}
          disabled={importState.isLoading}
          variant="outlined"
          startIcon={<CallSplitIcon />}
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
          startIcon={<DeleteIcon />}
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

/** Image viewer with mouse-wheel zoom, pan, and zoom controls.
 *  Works with a raw dataUrl (ReceiptImagePayload) rather than the DB ReceiptImage type. */
function ZoomableViewer({
  open,
  imageDataUrl,
  imageName,
  onClose,
}: {
  open: boolean;
  imageDataUrl: string;
  imageName: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset zoom when modal opens/closes
  useEffect(() => {
    if (open) {
      setScale(1);
      setOffset({ x: 0, y: 0 });
    }
  }, [open]);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = -Math.sign(e.deltaY) * 0.15;
    setScale((prev) => Math.max(0.25, Math.min(8, +(prev + delta).toFixed(2))));
  }, []);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (scale <= 1) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  }, [scale, offset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isPanning) return;
    setOffset({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const zoomIn = useCallback(() => setScale((prev) => Math.min(8, +(prev + 0.25).toFixed(2))), []);
  const zoomOut = useCallback(() => setScale((prev) => Math.max(0.25, +(prev - 0.25).toFixed(2))), []);
  const resetZoom = useCallback(() => { setScale(1); setOffset({ x: 0, y: 0 }); }, []);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xl" fullWidth>
      <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" noWrap sx={{ maxWidth: '60%' }}>{imageName || 'Receipt'}</Typography>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
            {Math.round(scale * 100)}%
          </Typography>
          <IconButton onClick={zoomOut} size="small" title="Zoom out"><ZoomOutIcon fontSize="small" /></IconButton>
          <IconButton onClick={zoomIn} size="small" title="Zoom in"><ZoomInIcon fontSize="small" /></IconButton>
          {scale !== 1 ? (
            <IconButton onClick={resetZoom} size="small" title="Reset zoom"><RefreshIcon fontSize="small" /></IconButton>
          ) : null}
          <IconButton onClick={onClose} size="small">✕</IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent
        sx={{
          p: 0,
          bgcolor: '#000',
          overflow: 'hidden',
          cursor: scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
          position: 'relative',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '70vh',
            width: '100%',
            height: '100%',
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`,
            transformOrigin: 'center center',
            transition: isPanning ? 'none' : 'transform 0.15s ease',
            pointerEvents: scale <= 1 ? 'none' : 'auto',
          }}
        >
          <img
            ref={imgRef}
            src={imageDataUrl}
            alt={imageName || 'receipt'}
            draggable={false}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain', display: 'block' }}
          />
        </Box>
        {/* Dark vignette hint at bottom */}
        {scale <= 1 ? (
          <Typography
            sx={{
              position: 'absolute',
              bottom: 16,
              left: '50%',
              transform: 'translateX(-50%)',
              color: 'rgba(255,255,255,0.5)',
              fontSize: '0.75rem',
              pointerEvents: 'none',
            }}
          >
            Scroll to zoom · Drag to pan when zoomed in
          </Typography>
        ) : null}
      </DialogContent>
    </Dialog>
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
                          startIcon={<DeleteIcon />}
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
