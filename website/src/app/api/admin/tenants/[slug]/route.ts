/**
 * Single Tenant API — GET / PUT / DELETE /api/admin/tenants/[slug]
 *
 * PUT now syncs tenant data to the tenant's app_config + app_settings tables
 * via upsertFullTenantConfig, and extracts databaseUrl from metadata.config.database
 * into the top-level dbUrl column on the tenants table.
 *
 * This ensures tenant-info (GET /api/admin/tenant-info on the tenant app)
 * always reflects what the tenant administrator set via PUT or deploy.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureTenantsTable, updateTenantTemplate, upsertFullTenantConfig } from '@/domain/tenant/tenant-service';
import { inngest } from '@/lib/inngest';
import { cleanupTenant } from '@/domain/tenant/tenant-cleanup-service';

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

/**
 * Extract databaseUrl from metadata.config.database (various key shapes).
 */
function extractDbUrl(metadata: Record<string, unknown> | undefined): string | undefined {
  if (!metadata) return undefined;
  const config = metadata.config as Record<string, unknown> | undefined;
  if (!config) return undefined;
  const database = config.database as Record<string, unknown> | undefined;
  if (!database) return undefined;
  return (database.databaseUrl as string) || (database.postgresUrl as string) || undefined;
}

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
    console.error('[tenants] GET /${slug} error:', err);
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
    return jsonError('Validation failed: ' + parsed.error.issues.map((i) => i.message).join(', '), 400);
  }

  const db = createClient();
  try {
    const { template, ...restUpdates } = parsed.data;
    let responseData: Record<string, unknown> = {};
    let tenantRecord: Record<string, unknown>;

    // Extract databaseUrl from metadata.config.database → set dbUrl on tenants table
    const extractedDbUrl = extractDbUrl(parsed.data.metadata);
    const effectiveDbUrl = parsed.data.dbUrl ?? extractedDbUrl ?? null;

    if (template !== undefined) {
      // Delta-aware template change
      const result = await updateTenantTemplate(db, slug, {
        template,
        ...restUpdates,
        dbUrl: effectiveDbUrl,
        metadata: restUpdates.metadata || {},
      });
      tenantRecord = result.tenant as unknown as Record<string, unknown>;
      responseData = { tenant: result.tenant, delta: result.delta };

      if (result.delta) {
        await inngest.send({
          name: 'tenant.template.amended',
          data: {
            slug,
            previousTemplate: result.previousTemplate!,
            newTemplate: template,
            delta: result.delta,
            metadata: result.tenant.metadata as Record<string, unknown>,
          },
        }).catch((err) => {
          console.warn('[tenants] Failed to emit tenant.template.amended:', err);
        });
      }
    } else {
      // Regular non-template update
      await ensureTenantsTable(db);
      const existing = await db.tenant.findUnique({ where: { slug } });
      if (!existing) return jsonError('Tenant not found', 404);

      tenantRecord = await db.tenant.update({
        where: { slug },
        data: {
          ...parsed.data,
          dbUrl: effectiveDbUrl,
          metadata: parsed.data.metadata as never,
        },
      }) as unknown as Record<string, unknown>;
      responseData = { tenant: tenantRecord };
    }

    // ── Sync tenant data to app_config + app_settings on the tenant's own DB ──
    try {
      const tenantDbUrl =
        effectiveDbUrl ||
        process.env.POSTGRESS_URL ||
        process.env.POSTGRES_URL ||
        undefined;

      if (tenantDbUrl) {
        const templateValue = (tenantRecord.template as string) || template || 'default';
        const metadataRaw = tenantRecord.metadata as Record<string, unknown> | undefined;

        const configPayload: Record<string, unknown> = {
          displayName: tenantRecord.displayName || parsed.data.displayName,
          template: templateValue,
          status: tenantRecord.status || 'live',
          primaryColor: tenantRecord.primaryColor || '#eb3d28',
          secondaryColor: tenantRecord.secondaryColor || '#0af9fe',
          configVersion: '2.0',
          lastUpdated: new Date().toISOString(),
          lastDeployed: new Date().toISOString(),
          deployedTemplate: templateValue,
          amendmentReason: 'tenant-update',
          seededFromCatalog: true,
          aiContentGenerated: true,
          ...(metadataRaw?.config as Record<string, unknown> | undefined),
        };

        await upsertFullTenantConfig(
          tenantDbUrl,
          slug,
          templateValue,
          configPayload,
        );
      }
    } catch (syncErr) {
      console.warn('[tenants] PUT /' + slug + ' — sync to app_config failed (non-blocking):', syncErr);
    }

    return jsonOk(responseData);
  } catch (err: unknown) {
    console.error('[tenants] PUT /' + slug + ' error:', err);
    const message = err instanceof Error ? err.message : 'Failed to update tenant';
    return jsonError(message, 500);
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

    // Extract context for cleanup
    const cleanupContext: any = {
      tenantSlug: slug,
      tenantDbUrl: existing.dbUrl,
      vercelProjectId: existing.vercelProjectId,
      googleClientId: existing.googleClientId,
      googleProjectId: existing.googleProjectId,
    };

    // Delete the tenant record first
    await db.tenant.delete({ where: { slug } });

    // Trigger cleanup service
    try {
      const cleanupResult = await cleanupTenant(cleanupContext);
      
      if (!cleanupResult.success) {
        console.warn(`Tenant cleanup completed with errors for ${slug}:`, cleanupResult.errors);
      } else {
        console.log(`Tenant cleanup completed successfully for ${slug}`);
      }

      return jsonOk({
        deleted: true,
        cleanup: cleanupResult,
      });
    } catch (cleanupErr) {
      console.error(`Tenant cleanup failed for ${slug}:`, cleanupErr);
      // Still return success for tenant deletion, but report cleanup failure
      return jsonOk({
        deleted: true,
        cleanup: {
          success: false,
          errors: [cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)],
          cleanedResources: {},
        },
      });
    }
  } catch (err) {
    console.error('[tenants] DELETE /' + slug + ' error:', err);
    return jsonError('Failed to delete tenant', 500);
  }
}
