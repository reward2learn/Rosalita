import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { requireWriteAuth, requireRead, requireWrite } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureConversationsColumns } from '@/lib/db-migrate';

export const maxDuration = 30;

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

export interface AdminConversationView {
  id: number;
  user_name: string;
  owner_sub: string | null;
  title: string;
  message_count: number;
  archived: boolean;
  created_at: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireRead('conversations', request);
  if (!groupGuard.ok) return jsonError('Requires conversations:read', 403);

  const url = new URL(request.url);
  const includeArchived = url.searchParams.get('archived') === 'true';
  const owner = url.searchParams.get('owner');
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100', 10), 200);

  try {
    await ensureConversationsOnce();
  } catch {
    // Best-effort column ensure.
  }

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    const rows = await db.conversation.findMany({
      where: {
        ...(includeArchived ? {} : { archived: false }),
        ...(owner ? { ownerSub: owner } : {}),
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

    const conversations: AdminConversationView[] = rows.map((r) => ({
      id: r.id,
      user_name: r.userName,
      owner_sub: r.ownerSub,
      title: r.title,
      message_count: r.messageCount,
      archived: r.archived,
      created_at: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    }));

    return jsonOk({ conversations });
  } catch (err) {
    console.error('[admin/conversations] GET error:', err);
    return jsonError('Failed to load conversations', 500);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const groupGuard = await requireWrite('conversations', request);
  if (!groupGuard.ok) return jsonError('Requires conversations:write', 403);

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const numId = id ? parseInt(id, 10) : NaN;
  if (!id || Number.isNaN(numId)) return jsonError('Invalid id', 400);

  const archiveParam = url.searchParams.get('archived');
  if (archiveParam !== 'true' && archiveParam !== 'false') {
    return jsonError('archived=true|false is required', 400);
  }
  const archived = archiveParam === 'true';

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  } catch {
    return jsonError('Database unavailable', 503);
  }

  const existing = await db.conversation.findUnique({ where: { id: numId } });
  if (!existing) return jsonError('Conversation not found', 404);

  const updated = await db.conversation.update({
    where: { id: numId },
    data: { archived },
  });

  return jsonOk({ id: updated.id, archived: updated.archived });
}
