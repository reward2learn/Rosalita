'use client';

import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
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
import {
  CONFIG_UPLOAD_FIELD_NAMES,
  hasAnyUpload,
  validateExcelUpload,
  validateMarkdownUpload,
} from '@/lib/config/upload-validation';
import { useReseedFromSourcesMutation } from '@/store/apis/config-api';
import type { ReseedResponse } from '@/app/api/config/reseed/route';

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
}[] = [
  {
    key: 'excel',
    formName: 'excel',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.excel,
    label: 'Cashflow workbook (XLSX)',
    accept: '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel',
    hint: 'Red Ruby Club & Terrace Bar Cashflow Budgets.xlsx',
  },
  {
    key: 'businessReview',
    formName: 'businessReview',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.businessReview,
    label: 'Business Review (Markdown)',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    hint: 'Red Ruby Business Review — June 2026.md',
  },
  {
    key: 'executiveSummary',
    formName: 'executiveSummary',
    apiName: CONFIG_UPLOAD_FIELD_NAMES.executiveSummary,
    label: 'Executive Summary (Markdown)',
    accept: '.md,.markdown,.txt,text/markdown,text/plain',
    hint: 'Red Ruby Executive Summary — June 2026.md',
  },
];

function fileFromList(list: FileList | null | undefined): File | null {
  if (!list || list.length === 0) return null;
  return list[0] ?? null;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function SourceUploadForm() {
  const [reseed, { isLoading, isError, error, isSuccess, data, reset: resetMutation }] =
    useReseedFromSourcesMutation();
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
      excel: fileFromList(watched.excel),
      businessReview: fileFromList(watched.businessReview),
      executiveSummary: fileFromList(watched.executiveSummary),
    }),
    [watched.businessReview, watched.executiveSummary, watched.excel],
  );

  const onSubmit = async (values: SourceUploadFormValues) => {
    const files = {
      excel: fileFromList(values.excel),
      businessReview: fileFromList(values.businessReview),
      executiveSummary: fileFromList(values.executiveSummary),
    };

    if (!hasAnyUpload(files)) {
      return;
    }

    const formData = new FormData();
    if (files.excel) formData.append(CONFIG_UPLOAD_FIELD_NAMES.excel, files.excel);
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

  const updateFieldStatus = (field: FileField, file: File | null) => {
    let message: string | null = null;
    if (file) {
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
                  {file ? file.name : 'Choose file'}
                  <input
                    type="file"
                    hidden
                    accept={field.accept}
                    {...register(field.formName, {
                      onChange: (event) => {
                        const input = event.target as HTMLInputElement;
                        const chosen = fileFromList(input.files);
                        updateFieldStatus(field.key, chosen);
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
    </Box>
  );
}

function SeedSummary({ result }: { result: ReseedResponse }) {
  const rows = Object.entries(result.counts) as [string, number][];

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        Seed summary
      </Typography>
      <Stack direction="row" spacing={1} useFlexGap sx={{ mb: 2, flexWrap: 'wrap' }}>
        {result.uploaded.map((key) => (
          <Chip key={key} size="small" color="primary" label={`Uploaded: ${key}`} />
        ))}
        {(Object.entries(result.filesUsed) as [string, string][]).map(([key, source]) => (
          <Chip key={`${key}-${source}`} size="small" variant="outlined" label={`${key}: ${source}`} />
        ))}
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Table</TableCell>
            <TableCell align="right">Rows</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map(([table, count]) => (
            <TableRow key={table}>
              <TableCell>{table}</TableCell>
              <TableCell align="right">{count}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Paper>
  );
}
