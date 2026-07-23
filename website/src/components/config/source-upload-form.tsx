'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DescriptionIcon from '@mui/icons-material/Description';
import SummarizeIcon from '@mui/icons-material/Summarize';
import {
  CONFIG_UPLOAD_FIELD_NAMES,
  hasAnyUpload,
  validateExcelUpload,
  validateMarkdownUpload,
} from '@/lib/config/upload-validation';
import { useReseedFromSourcesMutation, useReprocessFromCacheMutation, useGetSeedDetailsQuery } from '@/store/apis/config-api';
import type { ReseedResponse } from '@/app/api/config/reseed/route';
import type { ReprocessResponse } from '@/app/api/config/reprocess/route';

interface SourceUploadFormValues {
  excel: FileList | null;
  businessReview: FileList | null;
  executiveSummary: FileList | null;
}

type FileField = 'excel' | 'businessReview' | 'executiveSummary';

const FILE_FIELDS: {
  key: FileField;
  formName: keyof SourceUploadFormValues;
  apiName: string;
  label: string;
  accept: string;
  hint: string;
  multiple?: boolean;
}[] = [
  {
    key: 'excel',
    formName: 'excel',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.excel,
    label: 'Cashflow workbooks (XLSX)',
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    hint: 'Upload one or more workbooks. Multiple workbooks (e.g. different months or departments) are merged.',
    multiple: true,
  },
  {
    key: 'businessReview',
    formName: 'businessReview',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.businessReview,
    label: 'Business Review (Markdown)',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    hint: 'business-review.md — or use AI Content Generation tab to auto-generate from the workbook',
  },
  {
    key: 'executiveSummary',
    formName: 'executiveSummary',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.executiveSummary,
    label: 'Executive Summary (Markdown)',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    hint: 'executive-summary.md — or use AI Content Generation tab to auto-generate from the workbook',
  },
];

function fileFromList(list: FileList | null | undefined): File | null {
  if (!list || list.length === 0) return null;
  return list[0] ?? null;
}

function filesFromList(list: FileList | null | undefined): File[] {
  if (!list || list.length === 0) return [];
  return Array.from(list).filter(Boolean);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourceUploadForm({ showSummaryOnly }: { showSummaryOnly?: boolean }) {
  const [reseed, { isLoading, isError, error, isSuccess, data, reset: resetMutation }] =
    useReseedFromSourcesMutation();
  const [reprocess, { isLoading: isReprocessing, isError: isReprocessError, error: reprocessError, isSuccess: isReprocessSuccess, data: reprocessData, reset: resetReprocess }] =
    useReprocessFromCacheMutation();
  const [fieldStatus, setFieldStatus] = useState<Record<FileField, string | null>>({
    excel: null,
    businessReview: null,
    executiveSummary: null,
  });

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<SourceUploadFormValues>({
    defaultValues: {
      excel: null,
      businessReview: null,
      executiveSummary: null,
    },
  });

  const watched = watch();

  const selectedFiles = useMemo(
    () => ({
      excel: filesFromList(watched.excel),
      businessReview: fileFromList(watched.businessReview),
      executiveSummary: fileFromList(watched.executiveSummary),
    }),
    [watched.businessReview, watched.executiveSummary, watched.excel],
  );

  const onSubmit = async (values: SourceUploadFormValues) => {
    const files = {
      excel: filesFromList(values.excel),
      businessReview: fileFromList(values.businessReview),
      executiveSummary: fileFromList(values.executiveSummary),
    };

    if (!hasAnyUpload(files)) {
      return;
    }

    const formData = new FormData();
    if (files.excel.length > 0) {
      for (const f of files.excel) {
        formData.append(CONFIG_UPLOAD_FIELD_NAMES.excel, f);
      }
    }
    if (files.businessReview) {
      formData.append(CONFIG_UPLOAD_FIELD_NAMES.businessReview, files.businessReview);
    }
    if (files.executiveSummary) {
      formData.append(CONFIG_UPLOAD_FIELD_NAMES.executiveSummary, files.executiveSummary);
    }

    resetMutation();
    await reseed(formData).unwrap();
    reset();
    setFieldStatus({ excel: null, businessReview: null, executiveSummary: null });
  };

  const updateFieldStatus = (field: FileField, file: File | string | null) => {
    let message: string | null = null;
    if (typeof file === 'string') {
      message = file; // e.g. "3 file(s) selected"
    } else if (file) {
      if (field === 'excel') {
        message = validateExcelUpload(file);
      } else if (field === 'businessReview') {
        message = validateMarkdownUpload(file, 'Business Review');
      } else {
        message = validateMarkdownUpload(file, 'Executive Summary');
      }
      if (!message) {
        message = `Ready — ${file.name} (${formatBytes(file.size)})`;
      }
    }
    setFieldStatus((prev) => ({ ...prev, [field]: message }));
  };

  const result: ReseedResponse | undefined = data?.success ? data.data : undefined;
  const apiError =
    isError && error && 'data' in error
      ? String((error.data as { error?: string })?.error ?? 'Upload and reseed failed')
      : isError
        ? 'Upload and reseed failed'
        : null;

  return (
    <Box component="section" sx={{ maxWidth: 720, mx: 'auto', py: 4, px: 2 }}>
      {!showSummaryOnly ? (
        <>
          <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
            Source Config
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Upload one or more source files to replace on disk and re-run the database seed pipeline.
            Omitted files keep their existing copies.
          </Typography>

          <Paper variant="outlined" sx={{ p: 3, mb: 3 }}>
            <Stack
              component="form"
              spacing={3}
              onSubmit={handleSubmit(onSubmit)}
              data-testid="source-upload-form"
            >
              {FILE_FIELDS.map((field) => {
                const file = selectedFiles[field.key];
                const status = fieldStatus[field.key];
                const isValid = file && status?.startsWith('Ready');

                return (
                  <Box key={field.key}>
                    <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                      {field.label}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      {field.hint}
                    </Typography>
                    <Button
                      component="label"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  fullWidth
                  sx={{ justifyContent: 'flex-start', textTransform: 'none' }}
                >
                  {file ? (Array.isArray(file) ? `${file.length} file(s)` : file.name) : 'Choose file'}
                  <input
                    type="file"
                    hidden
                    accept={field.accept}
                    multiple={field.multiple}
                    {...register(field.formName, {
                      onChange: (event) => {
                        const input = event.target as HTMLInputElement;
                        if (field.multiple) {
                          updateFieldStatus(field.key, input.files?.length ? `${input.files.length} file(s) selected` : null);
                        } else {
                          const chosen = fileFromList(input.files);
                          updateFieldStatus(field.key, chosen);
                        }
                      },
                    })}
                  />
                </Button>
                {status ? (
                  <Typography
                    variant="caption"
                    color={isValid ? 'success.main' : 'error'}
                    sx={{ mt: 0.5, display: 'block' }}
                  >
                    {status}
                  </Typography>
                ) : null}
                {errors[field.formName] ? (
                  <Typography variant="caption" color="error" role="alert">
                    {errors[field.formName]?.message}
                  </Typography>
                ) : null}
              </Box>
            );
          })}

          <Button
            type="submit"
            variant="contained"
            disabled={isLoading || !hasAnyUpload(selectedFiles)}
            startIcon={isLoading ? <CircularProgress size={18} color="inherit" /> : undefined}
            data-testid="reseed-submit"
          >
            {isLoading ? 'Uploading & reseeding…' : 'Upload & reseed database'}
          </Button>
        </Stack>
      </Paper>

          {/* ── Reprocess from cached workbook ───────────────── */}
          <Paper variant="outlined" sx={{ p: 3, mb: 3, borderColor: isReprocessSuccess ? 'success.main' : undefined }}>
            <Stack spacing={2}>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Reprocess from cached workbook
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Re-run the seed pipeline using the previously uploaded workbook stored in the database.
                  No file re-upload required. This will refresh dynamic pages, sheet metadata, and knowledge snippets.
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="secondary"
                disabled={isReprocessing}
                startIcon={isReprocessing ? <CircularProgress size={18} color="inherit" /> : undefined}
                onClick={() => { resetReprocess(); void reprocess(); }}
                data-testid="reprocess-btn"
              >
                {isReprocessing ? 'Reprocessing…' : 'Reprocess from cache'}
              </Button>
              {isReprocessError && reprocessError && 'data' in reprocessError ? (
                <Alert severity="error" role="alert">
                  {String((reprocessError.data as { error?: string })?.error ?? 'Reprocess failed')}
                </Alert>
              ) : null}
              {isReprocessSuccess && reprocessData?.success && reprocessData.data ? (
                <Alert severity="success" role="status">
                  Reprocessed successfully from cached workbook.
                </Alert>
              ) : null}
            </Stack>
          </Paper>
        </>
      ) : null}

      {apiError ? (
        <Alert severity="error" sx={{ mb: 2 }} role="alert">
          {apiError}
        </Alert>
      ) : null}

      {isSuccess && result ? (
        <Alert severity="success" sx={{ mb: 2 }} role="status">
          Database reseeded successfully.
        </Alert>
      ) : null}

      {result ? <SeedSummary result={result} /> : null}

      {isReprocessSuccess && reprocessData?.success && reprocessData.data ? (
        <SeedSummary result={reprocessData.data} />
      ) : null}
    </Box>
  );
}

interface SeedDetails {
  counts: Record<string, number>;
  pageDetails: { slug: string; title: string; authTier: string; sectionCount: number; sections: { blockType: string; sortOrder: number }[] }[];
  reviewPartDetails: { slug: string; title: string; partKey: string; markdownLength: number; markdownPreview: string }[];
  snippetDetails: { key: string; category: string; contentLength: number; contentPreview: string }[];
  taskDetails: { title: string; priority: string; status: string; roles: string[] }[];
  roleDetails: { code: string; name: string; email: string | null }[];
  targetDetails: { month: string; targetRevenue: number; targetEbitda: number; targetGuests: number }[];
  leverDetails: { num: number; name: string; impact: string }[];
  actionItemDetails: { priority: string; label: string; completed: boolean }[];
  executiveSummary: string | null;
  seedStatus?: {
    ok: boolean;
    warnings: string[];
    totalTables: number;
    totalRows: number;
  };
}

/** Human-readable labels for the seed table keys. */
const TABLE_LABELS: Record<string, string> = {
  appPages: 'App Pages',
  pageSections: 'Page Sections',
  businessReviewParts: 'Business Review Parts',
  knowledgeSnippets: 'Knowledge Snippets',
  tasks: 'Tasks',
  roles: 'Roles',
  monthlyTargets: 'Monthly Targets',
  levers: 'Levers',
  actionItems: 'Action Items',
  financialProjections: 'Financial Projections',
};

function SeedSummary({ result }: { result: ReseedResponse }) {
  const rows = Object.entries(result.counts) as [string, number][];
  const [details, setDetails] = useState<SeedDetails | null>(null);
  const [expandedTable, setExpandedTable] = useState<string | null>(null);
  const [showAiContent, setShowAiContent] = useState(false);

  const { data: seedDetailsData, isLoading: detailsLoading } = useGetSeedDetailsQuery();

  useEffect(() => {
    if (seedDetailsData?.success) {
      setDetails(seedDetailsData as unknown as SeedDetails);
    }
  }, [seedDetailsData]);

  const handleToggle = (table: string) => {
    if (expandedTable === table) {
      setExpandedTable(null);
      return;
    }
    setExpandedTable(table);
  };

  /** Render the detail panel for a given table. */
  function renderDetail(table: string) {
    if (!details) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <CircularProgress size={20} />
        </Box>
      );
    }

    switch (table) {
      case 'appPages':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Slug</TableCell>
                <TableCell>Title</TableCell>
                <TableCell>Tier</TableCell>
                <TableCell align="right">Sections</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.pageDetails.map((p) => (
                <TableRow key={p.slug}>
                  <TableCell>{p.slug}</TableCell>
                  <TableCell>{p.title}</TableCell>
                  <TableCell>{p.authTier}</TableCell>
                  <TableCell align="right">{p.sectionCount}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'pageSections':
        return (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {(details.counts?.pageSections ?? 0)} sections across{' '}
            {details.pageDetails.length} pages. Each section renders a block type (chart, table, markdown, etc.)
            in the corresponding page.
          </Typography>
        );

      case 'businessReviewParts':
        if (details.reviewPartDetails.length === 0) {
          return (
            <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
              No Business Review parts seeded. Use the AI Content Generation tab to generate them from the workbook.
            </Typography>
          );
        }
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Part</TableCell>
                <TableCell>Title</TableCell>
                <TableCell align="right">Length</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.reviewPartDetails.map((p) => (
                <TableRow key={p.slug}>
                  <TableCell>{p.partKey}</TableCell>
                  <TableCell>{p.title}</TableCell>
                  <TableCell align="right">{(p.markdownLength / 1000).toFixed(1)}K</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'knowledgeSnippets':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Key</TableCell>
                <TableCell>Category</TableCell>
                <TableCell align="right">Length</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.snippetDetails.map((s) => (
                <TableRow key={s.key}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{s.key}</TableCell>
                  <TableCell>{s.category}</TableCell>
                  <TableCell align="right">{(s.contentLength / 1000).toFixed(1)}K</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'tasks':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Task</TableCell>
                <TableCell>Priority</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Roles</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.taskDetails.map((t, i) => (
                <TableRow key={i}>
                  <TableCell>{t.title}</TableCell>
                  <TableCell>{t.priority}</TableCell>
                  <TableCell>{t.status}</TableCell>
                  <TableCell>{t.roles.join(', ') || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'roles':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Code</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.roleDetails.map((r) => (
                <TableRow key={r.code}>
                  <TableCell>{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.email ?? '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'monthlyTargets':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Month</TableCell>
                <TableCell align="right">Revenue</TableCell>
                <TableCell align="right">EBITDA</TableCell>
                <TableCell align="right">Guests</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.targetDetails.map((t) => (
                <TableRow key={t.month}>
                  <TableCell>{t.month}</TableCell>
                  <TableCell align="right">{t.targetRevenue.toLocaleString('id-ID')}</TableCell>
                  <TableCell align="right">{t.targetEbitda.toLocaleString('id-ID')}</TableCell>
                  <TableCell align="right">{t.targetGuests}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'levers':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Impact</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.leverDetails.map((l) => (
                <TableRow key={l.num}>
                  <TableCell>{l.num}</TableCell>
                  <TableCell>{l.name}</TableCell>
                  <TableCell>{l.impact}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      case 'actionItems':
        return (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Priority</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Done</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {details.actionItemDetails.map((a, i) => (
                <TableRow key={i}>
                  <TableCell>{a.priority}</TableCell>
                  <TableCell>{a.label}</TableCell>
                  <TableCell>{a.completed ? '✓' : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        );

      default:
        return (
          <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
            {result.counts[table as keyof typeof result.counts] ?? 0} rows seeded in <code>{table}</code>.
          </Typography>
        );
    }
  }

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
          Seed Summary
        </Typography>
        <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
          {result.uploaded.map((key) => (
            <Chip key={key} size="small" color="primary" label={`Uploaded: ${key}`} />
          ))}
          {(Object.entries(result.filesUsed) as [string, string][]).map(([key, source]) => (
            <Chip key={`${key}-${source}`} size="small" variant="outlined" label={`${key}: ${source}`} />
          ))}
        </Stack>

        {/* ── Seed status / warnings ──────────────────────── */}
        {details?.seedStatus ? (
          <Box sx={{ mb: 2 }}>
            {details.seedStatus.warnings.length > 0 ? (
              <Alert severity="warning" sx={{ mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                  Seed completed with {details.seedStatus.warnings.length} warning(s)
                </Typography>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {details.seedStatus.warnings.map((w, i) => (
                    <li key={i}>
                      <Typography variant="caption">{w}</Typography>
                    </li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <Alert severity="success" sx={{ mb: 1 }}>
                <Typography variant="body2">
                  Seed completed successfully — {details.seedStatus.totalRows} rows across {details.seedStatus.totalTables} tables.
                </Typography>
              </Alert>
            )}
          </Box>
        ) : null}

        {rows.map(([table, count]) => (
          <Accordion
            key={table}
            expanded={expandedTable === table}
            onChange={() => handleToggle(table)}
            elevation={0}
            sx={{
              border: '1px solid',
              borderColor: 'divider',
              '&:before': { display: 'none' },
              mb: 0.5,
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  flex: 1,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>{TABLE_LABELS[table] ?? table}</span>
                <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400, ml: 2 }}>
                  {count}
                </Box>
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider', pt: 1.5 }}>
              {renderDetail(table)}
            </AccordionDetails>
          </Accordion>
        ))}
      </Paper>

      {/* ── AI-Generated Content ──────────────────────────── */}
      {details ? (
        <>
          {/* Business Review */}
          {details.reviewPartDetails.length > 0 ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <DescriptionIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  AI-Generated Business Review
                </Typography>
              </Stack>
              {details.reviewPartDetails.map((part) => (
                <Accordion
                  key={part.slug}
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    '&:before': { display: 'none' },
                    mb: 0.5,
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {part.title}
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
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
                      {part.markdownPreview}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              ))}
            </Paper>
          ) : null}

          {/* Executive Summary */}
          {details.executiveSummary ? (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 2 }}>
                <SummarizeIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  AI-Generated Executive Summary
                </Typography>
              </Stack>
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
                {details.executiveSummary.length > 2000
                  ? details.executiveSummary.slice(0, 2000) + '\n\n... (truncated, open the Summary page for the full document)'
                  : details.executiveSummary}
              </Typography>
              <Box sx={{ mt: 1 }}>
                <Button
                  size="small"
                  variant="text"
                  onClick={() => setShowAiContent(!showAiContent)}
                >
                  {showAiContent ? 'Show Less' : 'Show Full Content'}
                </Button>
              </Box>
              {showAiContent ? (
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
                    maxHeight: 600,
                    overflow: 'auto',
                    mt: 1,
                  }}
                >
                  {details.executiveSummary}
                </Typography>
              ) : null}
            </Paper>
          ) : null}

          {details.reviewPartDetails.length === 0 && !details.executiveSummary ? (
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'rgba(235,61,40,0.04)' }}>
              <Typography variant="body2" color="text.secondary">
                No AI-generated content available yet. Go to <strong>Platform Admin → AI Content Generation</strong>{' '}
                to generate the Business Review and Executive Summary from the workbook.
              </Typography>
            </Paper>
          ) : null}
        </>
      ) : null}
    </Stack>
  );
}
