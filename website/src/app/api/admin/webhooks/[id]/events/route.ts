/**
 * Webhook Event History API
 * GET /api/admin/webhooks/[id]/events
 * Returns recent webhook delivery events for a specific config.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import type { WebhookEventView } from '../../route';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin access required', 403);
  }

  const { id } = params;
  if (!id) {
    return jsonError('Missing webhook id', 400);
  }

  const url = new URL(request.url);
  const limit = parseInt(url.searchParams.get('limit') || '50');

  try {
    const db = createClient();
    const events = await db.webhookEvent.findMany({
      where: { configId: id },
      orderBy: { attemptedAt: 'desc' },
      take: Math.min(limit, 100),
    });

    const views: WebhookEventView[] = events.map((event) => ({
      id: event.id,
      configId: event.configId,
      eventType: event.eventType,
      status: event.status as 'pending' | 'success' | 'failed',
      payload: event.payload as Record<string, any>,
      responseCode: event.responseCode ?? undefined,
      responseBody: event.responseBody ?? undefined,
      errorMessage: event.errorMessage ?? undefined,
      attemptedAt: event.attemptedAt.toISOString(),
    }));

    return jsonOk({ events: views, count: events.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('webhook events GET error:', msg);
    return jsonError('Failed to load event history', 500);
  }
}
