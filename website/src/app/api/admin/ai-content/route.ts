/**
 * AI Content Generation API
 *
 * GET  /api/admin/ai-content
 *   Returns: prompt preview, data summary, current generated content status
 *
 * POST /api/admin/ai-content  (no Accept: text/event-stream)
 *   Standard blocking POST — reads Excel, calls OpenAI, saves to DB.
 *   Returns: generation result with saved content info
 *
 * POST /api/admin/ai-content  (Accept: text/event-stream or ?stream=true)
 *   SSE streaming — same pipeline but each stage is pushed as a server-sent event
 *   so the client can show real-time progress, notifications, and a progress bar.
 *
 *   Events:
 *     event: progress
 *     data: {"step":"extracting","message":"...","pct":5}
 *
 *     event: complete
 *     data: {"step":"complete","message":"...","pct":100,"detail":{...}}
 *
 *     event: error
 *     data: {"step":"error","message":"...","detail":{...}}
 *
 *   The last event is always either "complete" or "error".
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import type { DbSession } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError } from '@/lib/api/response';
import { extractExcelData, type ExcelData } from '@/domain/excel/excel-extractor';
import { buildGenerationPrompt, buildDataSummary } from '@/domain/ai-content/prompt-builder';
import { generateAndSave, type ProgressEvent } from '@/domain/ai-content/content-generator';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 min timeout for OpenAI calls

// ── Schema ──────────────────────────────────────────────

const postSchema = z.object({
  filePath: z.string().optional(),
  model: z.string().optional(),
});

// ── SSE helpers ─────────────────────────────────────────

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

const encoder = new TextEncoder();

function sseStream(run: (emit: (event: ProgressEvent) => void) => Promise<void>): ReadableStream<Uint8Array> {
  let streamController: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(c) {
      streamController = c;
    },
    cancel() {
      streamController = null;
    },
  });

  // Run the pipeline, pushing SSE events as progress is reported
  void (async () => {
    try {
      const db = createClient();

      await run((event: ProgressEvent) => {
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (!streamController) return;
        const ctrl: ReadableStreamDefaultController<Uint8Array> = streamController;
        try {
          const eventType = event.step === 'complete'
            ? 'complete'
            : event.step === 'error'
              ? 'error'
              : 'progress';
          ctrl.enqueue(encoder.encode(sseEvent(eventType, event)));

          // Close the stream on terminal events
          if (event.step === 'complete' || event.step === 'error') {
            ctrl.close();
          }
        } catch {
          // Stream may have been cancelled
        }
      });
    } catch (err) {
      if (!streamController) return;
      const ctrl: ReadableStreamDefaultController<Uint8Array> = streamController;
      try {
        ctrl.enqueue(
          encoder.encode(
            sseEvent('error', {
              step: 'error',
              message: err instanceof Error ? err.message : String(err),
              pct: 0,
            }),
          ),
        );
        ctrl.close();
      } catch {
        // ignore
      }
    }
  })();

  return stream;
}

// ── Workbook resolver ─────────────────────────────────

/**
 * Resolve the June 2026 workbook — try disk first, then the base64
 * cached copy stored by the reseed pipeline in knowledge_snippets.
 */
async function resolveWorkbook(): Promise<ExcelData> {
  // Try disk
  try {
    return extractExcelData();
  } catch {
    // not on disk
  }

  // Try DB cache
  try {
    const db = createClient();
    const cached = await db.knowledgeSnippet.findUnique({
      where: { key: 'workbook_data' },
    });
    if (cached?.content) {
      return extractExcelData(Buffer.from(cached.content, 'base64'));
    }
  } catch {
    // DB unavailable
  }

  throw new Error(
    'Workbook file not found on disk and no cached copy in database. ' +
    'Upload the June 2026 workbook via the Config page first.',
  );
}

// ── GET handler ─────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const guard = await requireWriteAuth(request);
    if (!guard.ok) return guard.response;
    if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

    // Resolve the workbook — try disk first, then DB cache (uploaded via /config/reseed).
    const data = await resolveWorkbook();

    const fullPrompt = buildGenerationPrompt(data);
    const promptPreview =
      fullPrompt.length > 3000
        ? fullPrompt.slice(0, 3000) + '\n\n... (truncated, full prompt available on request)'
        : fullPrompt;
    const dataSummary = buildDataSummary(data);

    const db = createClient();
    let existingContent: { executiveSummary: string | null; reviewParts: number } = {
      executiveSummary: null,
      reviewParts: 0,
    };

    try {
      const snippet = await db.knowledgeSnippet.findUnique({
        where: { key: 'executive_summary' },
      });
      existingContent.executiveSummary = snippet?.content
        ? snippet.content.slice(0, 500) + '...'
        : null;
      const partCount = await db.businessReviewPart.count();
      existingContent.reviewParts = partCount;
    } catch {
      // DB might not be available
    }

    return NextResponse.json({
      success: true,
      data: {
        promptLength: fullPrompt.length,
        promptPreview,
        dataSummary,
        existingContent,
        excelPeriod: data.period,
        excelCompany: data.company,
        tabs: [
          'Daily Sales', 'GL', 'TB', 'PL', 'BS', 'COS',
          'Month on Month', 'BEP Monthly', 'Monthly Variance', 'SUMPL', 'SumBS',
        ],
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST handler ────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  // Parse body regardless of stream mode (needed for filePath, model)
  const body = await request.json().catch(() => ({}));
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { filePath, model } = parsed.data;

  // Build a DbSession from the authenticated request (needed for ZenStack policy)
  const dbSession: DbSession = { tier: guard.session.tier as 'public' | 'pin' | 'google', sub: guard.session.sub };

  // Resolve the workbook source — try explicit filePath, then auto-detect, then DB cache.
  // In-memory Buffer is preferred on serverless runtimes where the filesystem is read-only.
  let source: string | Buffer | undefined;
  if (filePath) {
    source = filePath;
  } else {
    try {
      // Try disk (auto-detect)
      extractExcelData();
      source = undefined; // auto-detect succeeded, leave undefined so extractExcelData finds it
    } catch {
      // Not on disk — resolve via DB cache (uploaded during reseed)
      try {
        const db = createClient(dbSession);
        const cached = await db.knowledgeSnippet.findUnique({
          where: { key: 'workbook_data' },
        });
        if (cached?.content) {
          source = Buffer.from(cached.content, 'base64');
        }
      } catch {
        // DB unavailable
      }
    }
  }

  // ── SSE streaming mode ────────────────────────────────
  const wantsStream =
    request.headers.get('accept') === 'text/event-stream' ||
    new URL(request.url).searchParams.has('stream');

  if (wantsStream) {
    const stream = sseStream(async (emit) => {
      const db = createClient(dbSession);
      await generateAndSave(db, emit, source, model);
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }

  // ── Blocking (legacy) mode ────────────────────────────
  try {
    const db = createClient(dbSession);
    const result = await generateAndSave(db, undefined, source, model);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error, prompt: result.prompt },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        promptLength: result.prompt?.length ?? 0,
        contentLengths: {
          businessReview: result.content?.businessReview.length ?? 0,
          executiveSummary: result.content?.executiveSummary.length ?? 0,
        },
        saved: result.saved,
        model: result.content?.model,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
