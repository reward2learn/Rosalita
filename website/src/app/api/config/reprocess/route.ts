/**
 * Reprocess API — re-runs the seed pipeline using the cached workbook
 * from the database (stored as a `workbook_data` knowledge snippet).
 *
 * POST /api/config/reprocess
 *
 * This does NOT require re-uploading source files. It reads the
 * previously cached workbook and re-analyzes it, regenerating
 * dynamic pages, knowledge snippets, and summary content.
 *
 * Returns: { counts, filesUsed, uploaded }
 * On Vercel, `uploaded` will be empty and `filesUsed` will show
 * `disk` sources — the workbook is read from the DB cache.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma';
import { requireWriteAuth, requireCapability } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { seedFromSources, type SeedCounts } from '@/domain/seed/seed-runner';
import type { SourceFileKey } from '@/domain/seed/source-files';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 min

export interface ReprocessResponse {
  counts: SeedCounts;
  filesUsed: Record<SourceFileKey, 'upload' | 'disk'>;
  uploaded: SourceFileKey[];
  source: 'cache' | 'none';
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireCapability('config:write', request);
  if (!groupGuard.ok) return groupGuard.response;

  const prisma = new PrismaClient();

  try {
    // Read the primary cached workbook from knowledge_snippets
    const cached = await prisma.knowledgeSnippet.findUnique({
      where: { key: 'workbook_data' },
    });

    if (!cached) {
      return jsonError(
        'No cached workbook found. Upload the workbook via the Source tab first (Upload & reseed).',
        404,
      );
    }

    const excelBuffers: Buffer[] = [Buffer.from(cached.content, 'base64')];

    // Read additional cached workbooks (workbook_data_1, workbook_data_2, ...)
    for (let i = 1; i < 10; i++) {
      const extra = await prisma.knowledgeSnippet.findUnique({
        where: { key: `workbook_data_${i}` },
      });
      if (extra?.content) {
        excelBuffers.push(Buffer.from(extra.content, 'base64'));
      } else {
        break;
      }
    }

    const result = await seedFromSources({
      overrides: { excel: excelBuffers },
      persistOverrides: false, // read-only filesystem on Vercel
    });

    const payload: ReprocessResponse = {
      counts: result.counts,
      filesUsed: result.filesUsed,
      uploaded: [],
      source: 'cache',
    };

    return jsonOk(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reprocess failed';
    return jsonError(message, 500);
  } finally {
    await prisma.$disconnect();
  }
}
