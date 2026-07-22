import { NextResponse } from 'next/server';
import { requireWriteAuth, requireCapability } from '@/lib/auth/guards';
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

export const maxDuration = 300; // 5 min — workbook analysis + full DB seed can be heavy

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

function filesFromForm(formData: FormData, key: string): File[] {
  const files: File[] = [];
  // FormData.getAll returns all entries with the same key
  if (typeof formData.getAll === 'function') {
    for (const value of formData.getAll(key)) {
      if (value instanceof File && value.size > 0) files.push(value);
    }
  }
  return files;
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireCapability('config:write', request);
  if (!groupGuard.ok) return groupGuard.response;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Expected multipart/form-data', 400);
  }

  const excelFiles = filesFromForm(formData, CONFIG_UPLOAD_FIELD_NAMES.excel);
  const businessReviewFile = fileFromForm(formData, CONFIG_UPLOAD_FIELD_NAMES.businessReview);
  const executiveSummaryFile = fileFromForm(
    formData,
    CONFIG_UPLOAD_FIELD_NAMES.executiveSummary,
  );

  const validationErrors = [
    ...excelFiles.map((f) => validateExcelUpload(f)),
    validateMarkdownUpload(businessReviewFile, 'Business Review'),
    validateMarkdownUpload(executiveSummaryFile, 'Executive Summary'),
  ].filter((e): e is string => e != null);

  if (validationErrors.length > 0) {
    return jsonError(validationErrors.join('; '), 400);
  }

  if (excelFiles.length === 0 && !businessReviewFile && !executiveSummaryFile) {
    return jsonError('Select at least one source file to upload', 400);
  }

  try {
    const overrides: {
      excel?: Buffer[];
      businessReview?: string;
      executiveSummary?: string;
    } = {};

    const uploaded: SourceFileKey[] = [];

    if (excelFiles.length > 0) {
      for (const f of excelFiles) {
        if (f.size > MAX_EXCEL_BYTES) {
          return jsonError(`Workbook "${f.name}" exceeds size limit`, 400);
        }
      }
      overrides.excel = await Promise.all(
        excelFiles.map((f) => f.arrayBuffer().then((buf) => Buffer.from(buf))),
      );
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
