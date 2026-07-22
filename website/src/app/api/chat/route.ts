/**
 * Chat API — legacy reference: website/api/chat.js
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';
import { KnowledgeService } from '@/domain/knowledge/knowledge-service';
import { MONTHLY_TARGETS_SEED } from '@/domain/knowledge/knowledge-seed';
import { getSessionFromRequest } from '@/lib/auth/session';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { legacyError } from '@/lib/api/response';
import { sanitizeConversationMessages } from '@/lib/chat/conversation-messages';
import {
  attachmentDataUrl,
  describeAttachmentForPrompt,
  type ChatAttachment,
} from '@/lib/chat/attachments';
import { resolveTtsVoice } from '@/lib/chat/tts-voices';
import {
  CHAT_SESSION_TOOL_INSTRUCTIONS,
  type SessionToolContext,
} from '@/lib/chat/session-tools';
import {
  completeChatWithSessionTools,
  CHAT_WEB_SEARCH_INSTRUCTIONS,
  type OpenAiChatMessage,
} from '@/lib/chat/chat-with-session-tools';
import { resolveChatCompletionModel } from '@/lib/chat/chat-model';
import { getAppSettings } from '@/domain/config/app-settings-service';
import { isExplicitSessionRequest } from '@/lib/chat/session-tools';
import { ensureConversationsColumns } from '@/lib/db-migrate';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let conversationsEnsured: Promise<boolean> | null = null;
function ensureConversationsOnce(): Promise<boolean> {
  if (!conversationsEnsured) {
    conversationsEnsured = ensureConversationsColumns(createClient()).catch((err) => {
      conversationsEnsured = null;
      throw err;
    });
  }
  return conversationsEnsured;
}

const attachmentSchema = z.object({
  name: z.string(),
  mimeType: z.string(),
  size: z.number(),
  kind: z.enum(['image', 'spreadsheet', 'document']),
  dataBase64: z.string().optional(),
  extractedText: z.string().optional(),
  truncated: z.boolean().optional(),
});

const chatBodySchema = z.object({
  message: z.string().trim().min(1, 'Message is required'),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  attachments: z.array(attachmentSchema).optional(),
  stream: z.boolean().optional(),
});

const voiceBodySchema = z.object({
  text: z.string().min(1).max(5000),
  voice: z.string().optional(),
  speed: z.number().optional(),
});

const conversationPostSchema = z.object({
  title: z.string().optional(),
  messages: z.array(z.object({
    role: z.string(),
    content: z.string(),
    attachments: z.array(attachmentSchema).optional(),
  })).min(1),
});

const DB_KEYWORDS = [
  'actual', 'current', 'tracking', 'kpi', 'performance',
  'how are we', 'how did we', 'what was', 'what were',
  'revenue', 'ebitda', 'guests', 'covers', 'staff cost',
  'trend', 'compare', 'vs target', 'vs projection',
  'month to date', 'mtd', 'ytd', 'last month', 'this month',
  'progress', 'on track', 'behind', 'ahead',
  'show me', 'numbers', 'data', 'report', 'daily metrics',
  'weekly', 'monthly', 'average spend', 'avg spend',
  'spend per guest', ' performance',
];

function detectDatabaseQuery(message: string): boolean {
  const lower = message.toLowerCase();
  return DB_KEYWORDS.some((k) => lower.includes(k));
}

async function fetchDatabaseContext(db: ReturnType<typeof createClient>): Promise<string> {
  const parts: string[] = [];

  try {
    const recent = await db.dailyZReport.findMany({
      orderBy: { reportDate: 'desc' },
      take: 7,
      select: {
        reportDate: true,
        nettSales: true,
        totalCovers: true,
        avgCovers: true,
        totalBills: true,
        gofoodAmount: true,
        dineInAmount: true,
        totCollectionAmount: true,
        totalSales: true,
        tax10Amount: true,
        service7Amount: true,
      },
    });
    if (recent.length) {
      parts.push('=== RECENT DAILY DATA (last 7 entries) ===');
      parts.push('date | nett_sales | covers | avg_covers | bills | gofood | dine_in | collection');
      for (const r of recent) {
        const date = r.reportDate.toISOString().slice(0, 10);
        parts.push(
          `${date} | ${Number(r.nettSales).toLocaleString()} | ${r.totalCovers} | ${r.avgCovers ? Number(r.avgCovers).toLocaleString() : '-'} | ${r.totalBills || '-'} | ${r.gofoodAmount ? Number(r.gofoodAmount).toLocaleString() : '-'} | ${r.dineInAmount ? Number(r.dineInAmount).toLocaleString() : '-'} | ${r.totCollectionAmount ? Number(r.totCollectionAmount).toLocaleString() : '-'}`,
        );
      }
    }
  } catch {
    // optional context
  }

  try {
    const currentMonth = await db.$queryRaw<
      {
        month: string;
        total_revenue: number;
        days_count: number;
        avg_guests: number;
        avg_spend: number;
        total_gofood: number;
        total_dine_in: number;
      }[]
    >`
      SELECT
        TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS month,
        SUM(nett_sales)::float AS total_revenue,
        COUNT(*)::int AS days_count,
        ROUND(AVG(total_covers))::int AS avg_guests,
        ROUND(AVG(avg_covers))::float AS avg_spend,
        SUM(gofood_amount)::float AS total_gofood,
        SUM(dine_in_amount)::float AS total_dine_in
      FROM daily_z_reports
      WHERE DATE_TRUNC('month', report_date) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', report_date)`;

    if (currentMonth[0]) {
      const cm = currentMonth[0];
      parts.push('\n=== CURRENT MONTH (POS Z-reports) ===');
      parts.push(`Month: ${cm.month}, Days: ${cm.days_count}`);
      parts.push(`Nett Sales: ${Number(cm.total_revenue).toLocaleString()}`);
      parts.push(`Avg Covers/Day: ${cm.avg_guests}`);
      parts.push(`Avg Spend: ${Number(cm.avg_spend).toLocaleString()}`);
      parts.push(`GoFood: ${Number(cm.total_gofood).toLocaleString()}, Dine-in: ${Number(cm.total_dine_in).toLocaleString()}`);

      const target = MONTHLY_TARGETS_SEED.find((t) => t.month === cm.month);
      if (target) {
        const projRev = (Number(cm.total_revenue) / cm.days_count) * 30;
        parts.push('--- VS TARGET ---');
        parts.push(`Target Revenue: ${Number(target.revenue).toLocaleString()}, Projected: ${Math.round(projRev).toLocaleString()}`);
        parts.push(`Target Guests/Day: ${target.guests}, Actual: ${cm.avg_guests}`);
        parts.push(`Target Avg Spend: ${Number(target.spend).toLocaleString()}, Actual: ${Number(cm.avg_spend).toLocaleString()}`);
      }
    }
  } catch {
    // optional
  }

  if (!parts.length) {
    parts.push('(No data in database yet — no daily metrics have been entered. Start by entering data on the Ops Admin page.)');
  }

  return parts.join('\n');
}

type OpenAiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

interface OpenAiMessage {
  role: string;
  content: string | OpenAiContentPart[];
}

/**
 * Build the OpenAI user message. Text and any spreadsheet / document context is
 * merged into the text part; embedded images become vision `image_url` parts so
 * the model can actually see them.
 */
function buildUserMessage(message: string, attachments: ChatAttachment[]): OpenAiMessage {
  if (!attachments.length) {
    return { role: 'user', content: message };
  }

  const textSections: string[] = [message];
  const imageParts: OpenAiContentPart[] = [];

  for (const attachment of attachments) {
    if (attachment.kind === 'image') {
      const url = attachmentDataUrl(attachment);
      if (url) {
        imageParts.push({ type: 'image_url', image_url: { url } });
        continue;
      }
    }
    textSections.push(`\n\n[Attachment] ${describeAttachmentForPrompt(attachment)}`);
  }

  if (!imageParts.length) {
    return { role: 'user', content: textSections.join('') };
  }

  return {
    role: 'user',
    content: [
      { type: 'text', text: textSections.join('') },
      ...imageParts,
    ],
  };
}

/**
 * MapReduce for oversized chat context.
 *
 * When the system prompt (knowledge snippets + instructions) exceeds the
 * model's rate limit, this function splits it into chunks, calls OpenAI
 * once per chunk to extract facts relevant to the user's question, then
 * combines everything into a compact context prompt for the final answer.
 *
 * This mirrors the two-phase pattern used in AI Content Generation.
 */
async function mapReduceContext(
  fullContext: string,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<string> {
  // Split the context into chunks by ## section headers
  const sections = fullContext.split(/(?=## )/);
  const chunks: string[] = [];
  let currentChunk = '';

  for (const section of sections) {
    if (currentChunk.length + section.length > 3000 && currentChunk.length > 0) {
      chunks.push(currentChunk);
      currentChunk = section;
    } else {
      currentChunk += section;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  // Map phase: extract relevant info from each chunk
  const extractedParts: string[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content: 'You extract relevant business context for a given user question. Return ONLY facts and data points relevant to the question, in 2-3 concise bullet points. If nothing is relevant, return "NONE". Do not include any other text.',
            },
            {
              role: 'user',
              content: `Context section ${i + 1}/${chunks.length}:\n${chunk}\n\nUser question: ${userMessage}\n\nExtract ONLY facts/data points relevant to answering this question. Return "NONE" if nothing is relevant.`,
            },
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const reply = result.choices?.[0]?.message?.content ?? '';
        if (reply.trim() !== 'NONE') {
          extractedParts.push(reply.trim());
        }
      }
    } catch {
      // skip failed chunk
    }
  }

  // Reduce: build a compact context from extracted parts
  if (extractedParts.length === 0) {
    return fullContext.slice(0, 15000);
  }

  const reduced = [
    '## Business Context (Relevant excerpts)',
    '',
    ...extractedParts,
    '',
    '## Monthly Projection Targets',
    fullContext.includes('Monthly Projection Targets')
      ? fullContext.split('## Monthly Projection Targets')[1]?.split('## How You Answer')[0]?.trim() ?? ''
      : '',
    '',
    '## How You Answer',
    '1. Use IDR formatting (e.g., "IDR 2.2B", "IDR 166M").',
    '2. Reference specific Business Review parts when relevant.',
    '3. Use live database data for performance tracking questions.',
    '4. Be concise and data-driven.',
    '5. Highlight BEP coverage and margin metrics.',
  ].join('\n');

  return reduced;
}

async function handleChatPost(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return legacyError('Invalid JSON body', 400);
  }

  const parsed = chatBodySchema.safeParse(body);
  if (!parsed.success) {
    return legacyError('Message is required', 400);
  }

  const { message, history = [], stream, attachments = [] } = parsed.data;
  const session = await getSessionFromRequest(request);
  const userName = session?.name || session?.email || 'Anonymous';
  const db = createClient({
    tier: session?.tier ?? 'public',
    ...(session?.sub !== undefined ? { sub: session.sub } : {}),
  });
  const knowledge = new KnowledgeService(db);

  try {
    const needsDb = detectDatabaseQuery(message);
    let dbContext = '';
    if (needsDb) {
      try {
        dbContext = await fetchDatabaseContext(db);
      } catch {
        // non-fatal
      }
    }

    const systemPrompt = await knowledge.buildSystemPrompt();

    // Resolve API key early — needed for MapReduce phase below
    const apiKey = await resolveOpenAiKey();
    if (!apiKey) {
      const reply = 'I\'m not fully configured yet. The owner needs to add an OpenAI API key.';
      if (stream === true) {
        const encoder = new TextEncoder();
        const sseBody = new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: reply } }] })}\n\n`));
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        });
        return new Response(sseBody, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
          },
        });
      }
      return NextResponse.json({
        success: true,
        data: { reply },
      });
    }

    const appSettings = await getAppSettings(db);
    const webSearchEnabled = appSettings.webSearchEnabled;
    const sessionToolsEnabled = isExplicitSessionRequest(message);

    const systemSections = [
      systemPrompt,
      ...(sessionToolsEnabled ? [CHAT_SESSION_TOOL_INSTRUCTIONS] : []),
      ...(webSearchEnabled ? [CHAT_WEB_SEARCH_INSTRUCTIONS] : []),
    ];

    const messages: OpenAiChatMessage[] = [{
      role: 'system',
      content: systemSections.join('\n\n'),
    }];

    // ── MapReduce: if system prompt is too large, extract relevant context in chunks ──
    const systemMsg = messages[0];
    if (systemMsg && typeof systemMsg.content === 'string' && systemMsg.content.length > 18000) {
      try {
        const reducedContext = await mapReduceContext(
          systemMsg.content,
          message,
          apiKey,
          'gpt-4o-mini', // cheaper model for the map phase
        );
        systemMsg.content = reducedContext;
      } catch {
        // If MapReduce fails, fall back to simple truncation
        if (typeof systemMsg.content === 'string') {
          systemMsg.content = systemMsg.content.slice(0, 20000)
            + '\n\n[Context truncated to fit model limits — see Business Review parts for full details]';
        }
      }
    }

    for (const msg of history.slice(-6)) {
      if (msg.role === 'user' || msg.role === 'assistant') {
        messages.push({ role: msg.role, content: msg.content });
      }
    }

    if (dbContext) {
      messages.push({
        role: 'system',
        content: `[DATABASE QUERY RESULT — Current actuals from the database]\n${dbContext}\n\nUse this data to answer the user's question.`,
      });
    }

    messages.push(buildUserMessage(message, attachments));

    const sessionMessages = [
      ...history
        .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
        .map((msg) => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message },
    ];

    const toolContext: SessionToolContext = {
      db,
      userName,
      messages: sessionMessages,
    };

    return completeChatWithSessionTools({
      apiKey,
      model: resolveChatCompletionModel(webSearchEnabled),
      messages,
      toolContext,
      stream: stream === true,
      webSearchEnabled,
      sessionToolsEnabled,
    });
  } catch (err) {
    console.error('CHAT ERROR:', err);
    return NextResponse.json({
      success: true,
      data: { reply: 'I encountered an error processing your request. Please try again in a moment.' },
    });
  }
}

async function handleVoicePost(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = voiceBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'Text is required' }, { status: 400 });
  }

  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'OpenAI API key not configured' }, { status: 503 });
  }

  const voice = resolveTtsVoice(parsed.data.voice);
  const rate = Math.max(0.25, Math.min(2.0, parsed.data.speed || 1.0));

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OPENAI_TTS_MODEL || 'tts-1',
        input: parsed.data.text.trim(),
        voice,
        response_format: 'mp3',
        speed: rate,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI TTS API error: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');

    return NextResponse.json({ success: true, data: { audioChunks: [base64], format: 'mp3' } });
  } catch (err) {
    console.error('[voice] Error:', err);
    return NextResponse.json({ success: false, error: 'Voice synthesis failed' }, { status: 500 });
  }
}

async function handleConversations(request: Request, url: URL): Promise<NextResponse> {
  const session = await getSessionFromRequest(request);
  try {
    await ensureConversationsOnce();
  } catch {
    // Best-effort column ensure; queries surface a clear error if columns are missing.
  }
  const userName = session?.name || session?.email || 'Anonymous';
  const db = createClient({
    tier: session?.tier ?? 'public',
    ...(session?.sub !== undefined ? { sub: session.sub } : {}),
  });

  if (request.method === 'POST') {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return legacyError('Invalid JSON', 400);
    }

    const parsed = conversationPostSchema.safeParse(body);
    if (!parsed.success) {
      return legacyError('messages array is required and must not be empty', 400);
    }

    try {
      const messages = sanitizeConversationMessages(parsed.data.messages);
      const saved = await db.conversation.create({
        data: {
          userName,
          ownerSub: session?.sub ?? null,
          title: (parsed.data.title || 'Chat Conversation').slice(0, 200),
          messages: messages as object[],
          messageCount: messages.length,
        },
      });
      return NextResponse.json(
        { success: true, data: { ok: true, id: saved.id, created_at: saved.createdAt } },
        { status: 201 },
      );
    } catch (err) {
      console.error('[conversations] POST error:', err);
      return legacyError('Failed to save conversation', 500);
    }
  }

  if (request.method === 'PATCH') {
    const id = url.searchParams.get('id');
    const numId = id ? parseInt(id, 10) : NaN;
    if (!id || Number.isNaN(numId)) return legacyError('Invalid id', 400);

    const existing = await db.conversation.findUnique({ where: { id: numId } });
    if (!existing) return legacyError('Conversation not found', 404);

    // Only the owner or a platform admin may archive/unarchive.
    if (!sessionIsPlatformAdmin(session) && existing.ownerSub && existing.ownerSub !== session?.sub) {
      return legacyError('Not allowed to modify this conversation', 403);
    }

    const archiveParam = url.searchParams.get('archived');
    const archived = archiveParam === 'true' ? true : archiveParam === 'false' ? false : !existing.archived;

    const updated = await db.conversation.update({
      where: { id: numId },
      data: { archived },
    });

    return NextResponse.json({
      success: true,
      data: { id: updated.id, archived: updated.archived },
    });
  }

  const id = url.searchParams.get('id');
  if (id) {
    const numId = parseInt(id, 10);
    if (Number.isNaN(numId)) return legacyError('Invalid id', 400);

    const row = await db.conversation.findUnique({ where: { id: numId } });
    if (!row) return legacyError('Conversation not found', 404);

    return NextResponse.json({
      success: true,
      data: {
        id: row.id,
        user_name: row.userName,
        title: row.title,
        messages: row.messages,
        message_count: row.messageCount,
        created_at: row.createdAt,
      },
    });
  }

  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 50);
  const includeArchived = url.searchParams.get('archived') === 'true';
  const ownerFilter = url.searchParams.get('owner');

  // Non-admins may only see their own conversations; admins may scope via ?owner=.
  const scopedOwner = sessionIsPlatformAdmin(session) ? ownerFilter ?? undefined : session?.sub;

  const rows = await db.conversation.findMany({
    where: {
      ...(includeArchived ? {} : { archived: false }),
      ...(scopedOwner ? { ownerSub: scopedOwner } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      userName: true,
      ownerSub: true,
      title: true,
      messageCount: true,
      archived: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: rows.map((r: {
      id: number;
      userName: string;
      ownerSub: string | null;
      title: string;
      messageCount: number;
      archived: boolean;
      createdAt: Date;
    }) => ({
      id: r.id,
      user_name: r.userName,
      owner_sub: r.ownerSub,
      title: r.title,
      message_count: r.messageCount,
      archived: r.archived,
      created_at: r.createdAt,
    })),
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (resource === 'conversations') {
    return handleConversations(request, url);
  }

  return legacyError('Method not allowed', 405);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (resource === 'voice') return handleVoicePost(request);
  if (resource === 'conversations') return handleConversations(request, url);

  return handleChatPost(request);
}

export async function PATCH(request: Request) {
  const url = new URL(request.url);
  const resource = url.searchParams.get('resource');

  if (resource === 'conversations') return handleConversations(request, url);

  return legacyError('Method not allowed', 405);
}
