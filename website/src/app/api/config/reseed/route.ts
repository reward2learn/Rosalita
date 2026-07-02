import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import {
  CONFIG_UPLOAD_FIELD_NAMES,
  MAX_EXCEL_BYTES,
  MAX_MARKDOWN_BYTES,
  validateExcelUpload,
  validateMarkdownUpload,
} from '@/lib/config/upload-validation';
import { seedFromSources, type SeedCounts } from '@/domain/seed/seed-runner';
import type { SourceFileKey } from '@/domain/seed/source-files';

export const maxDuration = 60;

export interface ReseedResponse {
  counts: SeedCounts;
  filesUsed: Record<SourceFileKey, 'upload' | 'disk'>;
  uploaded: SourceFileKey[];
}

function fileFromForm(formData: FormData, key: string): File | null {
  const value = formData.get(key);
  if (!(value instanceof File) || value.size === 0) return null;
  return value;
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Expected multipart/form-data', 400);
  }

  const excelFile = fileFromForm(formData, CONFIG_UPLOAD_FIELD_NAMES.excel);
  const businessReviewFile = fileFromForm(formData, CONFIG_UPLOAD_FIELD_NAMES.businessReview);
  const executiveSummaryFile = fileFromForm(
    formData,
    CONFIG_UPLOAD_FIELD_NAMES.executiveSummary,
  );

  const validationErrors = [
    validateExcelUpload(excelFile),
    validateMarkdownUpload(businessReviewFile, 'Business Review'),
    validateMarkdownUpload(executiveSummaryFile, 'Executive Summary'),
  ].filter((e): e is string => e != null);

  if (validationErrors.length > 0) {
    return jsonError(validationErrors.join('; '), 400);
  }

  if (!excelFile && !businessReviewFile && !executiveSummaryFile) {
    return jsonError('Select at least one source file to upload', 400);
  }

  try {
    const overrides: {
      excel?: Buffer;
      businessReview?: string;
      executiveSummary?: string;
    } = {};

    const uploaded: SourceFileKey[] = [];

    if (excelFile) {
      if (excelFile.size > MAX_EXCEL_BYTES) {
        return jsonError('Cashflow workbook exceeds size limit', 400);
      }
      overrides.excel = Buffer.from(await excelFile.arrayBuffer());
      uploaded.push('excel');
    }

    if (businessReviewFile) {
      if (businessReviewFile.size > MAX_MARKDOWN_BYTES) {
        return jsonError('Business Review exceeds size limit', 400);
      }
      overrides.businessReview = await businessReviewFile.text();
      uploaded.push('businessReview');
    }

    if (executiveSummaryFile) {
      if (executiveSummaryFile.size > MAX_MARKDOWN_BYTES) {
        return jsonError('Executive Summary exceeds size limit', 400);
      }
      overrides.executiveSummary = await executiveSummaryFile.text();
      uploaded.push('executiveSummary');
    }

    const result = await seedFromSources({
      overrides,
      persistOverrides: true,
    });

    const payload: ReseedResponse = {
      counts: result.counts,
      filesUsed: result.filesUsed,
      uploaded,
    };

    return jsonOk(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Seed failed';
    return jsonError(message, 500);
  }
}
