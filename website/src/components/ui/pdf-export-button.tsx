'use client';

import { useState } from 'react';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { useLazyGetPdfJobStatusQuery, useQueuePdfMutation } from '@/store/apis/pdf-api';

export interface PdfExportButtonProps {
  page?: string;
  label?: string;
}

export function PdfExportButton({ page = '/', label = 'Export PDF' }: PdfExportButtonProps) {
  const [queuePdf, { isLoading: isQueueing }] = useQueuePdfMutation();
  const [pollStatus] = useLazyGetPdfJobStatusQuery();
  const [status, setStatus] = useState<'idle' | 'polling' | 'done' | 'error'>('idle');

  const handleExport = async () => {
    setStatus('idle');
    try {
      const result = await queuePdf(page).unwrap();
      const jobId = result.data?.jobId;
      if (!jobId) {
        setStatus('error');
        return;
      }
      setStatus('polling');
      for (let i = 0; i < 30; i++) {
        await new Promise<void>((resolve) => {
          globalThis.setTimeout(resolve, 2000);
        });
        const job = await pollStatus(jobId).unwrap();
        if (job.status === 'completed' && job.pdfBase64) {
          const link = globalThis.document.createElement('a');
          link.href = `data:application/pdf;base64,${job.pdfBase64}`;
          link.download = 'rosalita-export.pdf';
          link.click();
          setStatus('done');
          return;
        }
        if (job.status === 'failed') {
          setStatus('error');
          return;
        }
      }
      setStatus('error');
    } catch {
      setStatus('error');
    }
  };

  const busy = isQueueing || status === 'polling';

  return (
    <Button
      variant="outlined"
      color="primary"
      onClick={handleExport}
      disabled={busy}
      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : undefined}
    >
      {busy ? 'Generating…' : status === 'done' ? 'Downloaded' : label}
    </Button>
  );
}
