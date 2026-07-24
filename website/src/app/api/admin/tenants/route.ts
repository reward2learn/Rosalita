/**
 * Tenant Registry API — CRUD for tenant applications
 *
 * GET    /api/admin/tenants         — list all tenants
 * POST   /api/admin/tenants         — create a new tenant
 * GET    /api/admin/tenants/[slug]  — get tenant by slug
 * PUT    /api/admin/tenants/[slug]  — update tenant
 * DELETE /api/admin/tenants/[slug]  — delete a tenant (soft)
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureTenantsTable } from '@/domain/tenant/tenant-service';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  slug: z.string().min(2).max(50).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  displayName: z.string().min(1).max(100),
  template: z.string().max(50).optional().default('default'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#eb3d28'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().default('#0af9fe'),
  metadata: z.record(z.unknown()).optional().default({}),
});

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  template: z.string().max(50).optional(),
  status: z.enum(['draft', 'deploying', 'live', 'error']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  appUrl: z.string().max(500).optional(),
  vercelProjectId: z.string().max(100).optional(),
  dbUrl: z.string().max(500).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ── GET /api/admin/tenants ───────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const db = createClient();
  try {
    await ensureTenantsTable(db);

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const tenants = await db.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return jsonOk({ tenants });
  } catch (err) {
    console.error('[tenants] GET error:', err);
    return jsonError('Failed to list tenants', 500);
  }
}

// ── POST /api/admin/tenants ──────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  const db = createClient();
  try {
    await ensureTenantsTable(db);

    // Check for duplicate slug
    const existing = await db.tenant.findUnique({ where: { slug: parsed.data.slug } });
    if (existing) {
      return jsonError(`Tenant slug "${parsed.data.slug}" already exists`, 409);
    }

    const tenant = await db.tenant.create({
      data: {
        slug: parsed.data.slug,
        displayName: parsed.data.displayName,
        template: parsed.data.template,
        status: 'draft',
        primaryColor: parsed.data.primaryColor,
        secondaryColor: parsed.data.secondaryColor,
        metadata: parsed.data.metadata as never,
        createdBy: guard.session.sub ?? guard.session.email ?? undefined,
      },
    });

    return jsonOk({ tenant });
  } catch (err) {
    console.error('[tenants] POST error:', err);
    return jsonError('Failed to create tenant', 500);
  }
}
