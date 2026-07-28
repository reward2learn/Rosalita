/**
 * Admin Webhook Configuration API
 *
 * GET    /api/admin/webhooks
 *   Returns list of webhook configs with last triggered info
 *
 * POST   /api/admin/webhooks
 *   Create new webhook config
 *
 * PUT    /api/admin/webhooks
 *   Update existing webhook config
 *
 * DELETE /api/admin/webhooks?id=xxx
 *   Delete webhook config (cascades to events)
 *
 * Supports Vercel, custom providers, event subscription, status toggle, test firing.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import type { DbClient } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export interface WebhookConfigView {
  id: string;
  provider: string;
  name?: string;
  endpoint: string;
  events: string[];
  isActive: boolean;
  lastTriggered?: string;
  createdAt: string;
  updatedAt: string;
  eventCount?: number;
}

export interface WebhookEventView {
  id: string;
  configId: string;
  eventType: string;
  status: 'pending' | 'success' | 'failed';
  payload: Record<string, any>;
  responseCode?: number;
  responseBody?: string;
  errorMessage?: string;
  attemptedAt: string;
}

// Validation schemas
const webhookConfigSchema = z.object({
  provider: z.enum(['vercel', 'stripe', 'custom', 'github']),
  name: z.string().min(1).max(100).optional(),
  endpoint: z.string().url('Must be a valid URL').max(500),
  secret: z.string().min(8).max(128).optional(),
  events: z.array(z.string().min(1)).min(1, 'At least one event required'),
  isActive: z.boolean().default(true),
});

const updateWebhookSchema = webhookConfigSchema.partial().extend({
  id: z.string().min(1),
});

async function getWebhookConfig(db: DbClient, id: string) {
  return db.webhookConfig.findUnique({
    where: { id },
    include: {
      eventsLog: {
        orderBy: { attemptedAt: 'desc' },
        take: 5,
      },
    },
  });
}

// GET - List all webhook configs
export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin access required', 403);
  }

  try {
    const db = createClient();
    const configs = await db.webhookConfig.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { eventsLog: true },
        },
      },
    });

    const views: WebhookConfigView[] = configs.map((config) => ({
      id: config.id,
      provider: config.provider,
      name: config.name || undefined,
      endpoint: config.endpoint,
      events: config.events,
      isActive: config.isActive,
      lastTriggered: config.lastTriggered ? config.lastTriggered.toISOString() : undefined,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
      eventCount: config._count.eventsLog,
    }));

    return jsonOk({ webhooks: views });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('webhooks GET error:', msg);
    return jsonError('Failed to load webhooks', 500);
  }
}

// POST - Create new webhook config
export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin access required', 403);
  }

  try {
    const body = await request.json();

    // Handle test requests for webhook (integrates with webhook delivery system)
    if (body.action === 'test') {
      const { id, eventType = 'test.webhook', payload = {} } = body;
      if (!id) {
        return jsonError('Webhook id required for test', 400);
      }

      const db = createClient();
      const config = await db.webhookConfig.findUnique({ where: { id } });
      if (!config) {
        return jsonError('Webhook configuration not found', 404);
      }
      if (!config.isActive) {
        return jsonError('Webhook is inactive', 400);
      }

      // Simulate delivery using the webhook service pattern
      // In full implementation, this would call triggerWebhookEvent from vercel-webhook-service.ts
      // which would sign the payload, POST to endpoint, and record the outcome in webhook_events table
      const fullPayload = {
        ...payload,
        eventType,
        timestamp: new Date().toISOString(),
        id: `test-${Date.now()}`,
      };

      let deliverySuccess = false;
      let responseCode = 200;
      let errorMessage: string | null = null;
      let responseBody: string | null = null;

      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-Event': eventType,
          'X-Webhook-Delivery': `test-${Date.now()}`,
        };

        if (config.secret) {
          // Simple signature simulation (in production use HMAC with secret)
          headers['X-Webhook-Signature'] = `sha256=test-signature-for-${config.id}`;
        }

        const res = await fetch(config.endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify(fullPayload),
        });

        responseCode = res.status;
        deliverySuccess = res.ok;
        responseBody = await res.text().catch(() => 'Unable to read response body');

        if (!deliverySuccess) {
          errorMessage = `HTTP ${res.status}`;
        }

        // Update lastTriggered
        await db.webhookConfig.update({
          where: { id },
          data: { lastTriggered: new Date() },
        });
      } catch (fetchErr) {
        deliverySuccess = false;
        errorMessage = fetchErr instanceof Error ? fetchErr.message : 'Network error';
        responseCode = 0;
      }

      // Log the delivery event to DB for audit trail (core of the webhook system)
      await db.webhookEvent.create({
        data: {
          configId: id,
          eventType,
          payload: fullPayload as any,
          status: deliverySuccess ? 'success' : 'failed',
          responseCode: responseCode > 0 ? responseCode : null,
          responseBody: responseBody || null,
          errorMessage: errorMessage || null,
        },
      });

      return jsonOk({
        success: deliverySuccess,
        eventId: `test-event-${Date.now()}`,
        message: deliverySuccess 
          ? `Test event delivered successfully to ${config.provider} endpoint` 
          : `Test event recorded but delivery failed (HTTP ${responseCode}). See event log.`,
      });
    }

    // Normal create webhook flow
    const parsed = webhookConfigSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(`Invalid input: ${parsed.error.errors.map(e => e.message).join(', ')}`, 400);
    }

    const { provider, name, endpoint, secret, events, isActive } = parsed.data;

    const db = createClient();
    const config = await db.webhookConfig.create({
      data: {
        provider,
        name: name || null,
        endpoint,
        secret: secret || null,
        events,
        isActive: isActive ?? true,
      },
    });

    const view: WebhookConfigView = {
      id: config.id,
      provider: config.provider,
      name: config.name || undefined,
      endpoint: config.endpoint,
      events: config.events,
      isActive: config.isActive,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };

    return jsonOk({ webhook: view }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('webhooks POST error:', msg);
    return jsonError('Failed to create webhook or process test', 500);
  }
}

// PUT - Update webhook config
export async function PUT(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin access required', 403);
  }

  try {
    const body = await request.json();
    const parsed = updateWebhookSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError('Invalid input', 400);
    }

    const { id, ...updates } = parsed.data;

    const db = createClient();
    const existing = await db.webhookConfig.findUnique({ where: { id } });
    if (!existing) {
      return jsonError('Webhook not found', 404);
    }

    const data: any = {};
    if (updates.provider !== undefined) data.provider = updates.provider;
    if (updates.name !== undefined) data.name = updates.name || null;
    if (updates.endpoint !== undefined) data.endpoint = updates.endpoint;
    if (updates.secret !== undefined) data.secret = updates.secret || null;
    if (updates.events !== undefined) data.events = updates.events;
    if (updates.isActive !== undefined) data.isActive = updates.isActive;

    const config = await db.webhookConfig.update({
      where: { id },
      data,
    });

    const view: WebhookConfigView = {
      id: config.id,
      provider: config.provider,
      name: config.name || undefined,
      endpoint: config.endpoint,
      events: config.events,
      isActive: config.isActive,
      lastTriggered: config.lastTriggered ? config.lastTriggered.toISOString() : undefined,
      createdAt: config.createdAt.toISOString(),
      updatedAt: config.updatedAt.toISOString(),
    };

    return jsonOk({ webhook: view });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('webhooks PUT error:', msg);
    return jsonError('Failed to update webhook', 500);
  }
}

// DELETE - Delete webhook config
export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin access required', 403);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return jsonError('Missing id parameter', 400);
  }

  try {
    const db = createClient();
    await db.webhookConfig.delete({ where: { id } });
    return jsonOk({ deleted: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('not found')) {
      return jsonError('Webhook not found', 404);
    }
    console.error('webhooks DELETE error:', msg);
    return jsonError('Failed to delete webhook', 500);
  }
}
