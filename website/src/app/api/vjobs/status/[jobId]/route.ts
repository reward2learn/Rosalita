/**
 * PDF job status poll — legacy reference: website/api/vjobs/status/[jobId].js
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { PdfExportService } from '@/domain/pdf/pdf-export-service';
import { legacyError } from '@/lib/api/response';

export const maxDuration = 60;

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await context.params;
  if (!jobId) {
    return legacyError('Missing jobId', 400);
  }

  const db = createClient();
  const pdfService = new PdfExportService(db);

  try {
    const existing = await pdfService.getJobStatus(jobId);
    if (!existing) {
      return legacyError('Job not found', 404);
    }

    if (existing.status === 'PENDING') {
      const processed = await pdfService.processJob(jobId);
      return NextResponse.json({
        success: true,
        status: processed.status,
        ...(processed.pdfBase64 ? { pdfBase64: processed.pdfBase64 } : {}),
        ...(processed.details ? { details: processed.details } : {}),
      });
    }

    return NextResponse.json({
      success: true,
      status: existing.status,
      ...(existing.pdfBase64 ? { pdfBase64: existing.pdfBase64 } : {}),
      ...(existing.details ? { details: existing.details } : {}),
    });
  } catch (err) {
    console.error('[vjobs/status]', err);
    return legacyError('Internal server error', 500);
  }
}
