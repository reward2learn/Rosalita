/**
 * Single Tenant API — GET / PUT / DELETE /api/admin/tenants/[slug]
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureTenantsTable } from '@/domain/tenant/tenant-service';

export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  template: z.string().max(50).optional(),
  status: z.enum(['draft', 'deploying', 'live', 'error']).optional(),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  appUrl: z.string().max(500).optional().nullable(),
  vercelProjectId: z.string().max(100).optional().nullable(),
  dbUrl: z.string().max(500).optional().nullable(),
  metadata: z.record(z.unknown()).optional(),
});

// ── GET /api/admin/tenants/[slug] ────────────────────

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;
  const db = createClient();

  try {
    await ensureTenantsTable(db);
    const tenant = await db.tenant.findUnique({ where: { slug } });
    if (!tenant) return jsonError('Tenant not found', 404);
    return jsonOk({ tenant });
  } catch (err) {
    console.error(`[tenants] GET /${slug} error:`, err);
    return jsonError('Failed to fetch tenant', 500);
  }
}

// ── PUT /api/admin/tenants/[slug] ────────────────────

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  const db = createClient();
  try {
    await ensureTenantsTable(db);
    const existing = await db.tenant.findUnique({ where: { slug } });
    if (!existing) return jsonError('Tenant not found', 404);

    const tenant = await db.tenant.update({
      where: { slug },
      data: {
        ...parsed.data,
        metadata: parsed.data.metadata as never,
      },
    });

    return jsonOk({ tenant });
  } catch (err) {
    console.error(`[tenants] PUT /${slug} error:`, err);
    return jsonError('Failed to update tenant', 500);
  }
}

// ── DELETE /api/admin/tenants/[slug] ─────────────────

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;

  const db = createClient();
  try {
    await ensureTenantsTable(db);
    const existing = await db.tenant.findUnique({ where: { slug } });
    if (!existing) return jsonError('Tenant not found', 404);

    // Hard delete — permanently remove the tenant row
    await db.tenant.delete({ where: { slug } });

    return jsonOk({ deleted: true });
  } catch (err) {
    console.error(`[tenants] DELETE /${slug} error:`, err);
    return jsonError('Failed to delete tenant', 500);
  }
}
