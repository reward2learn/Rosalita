/**
 * POST /api/admin/tenants/[slug]/rename — rename a tenant's slug.
 * Updates the DB record, renames the Vercel project, and triggers redeploy.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBaseClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { renameVercelProject } from '@/domain/tenant/vercel-deploy-service';

const renameSchema = z.object({
  newSlug: z.string().min(2).max(50).regex(
    /^[a-z0-9-]+$/,
    'Slug must be lowercase alphanumeric with hyphens (a-z, 0-9, -)',
  ),
});

function mapTenantRow(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    slug: row.slug as string,
    displayName: row.display_name as string,
    template: row.template as string,
    status: row.status as string,
    vercelProjectId: row.vercel_project_id as string | null,
    appUrl: row.app_url as string | null,
    dbUrl: row.db_url as string | null,
    apiKey: row.api_key as string | null,
    primaryColor: row.primary_color as string,
    secondaryColor: row.secondary_color as string,
    metadata: row.metadata as Record<string, unknown>,
    createdBy: row.created_by as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export const dynamic = 'force-dynamic';

export async function POST(
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

  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  const newSlug = parsed.data.newSlug;

  // Cannot rename to the same slug
  if (newSlug === slug) {
    return jsonError('New slug is the same as the current slug', 400);
  }

  const db = createBaseClient() as any;

  try {
    // 1. Verify tenant exists
    const existingRows = await db.$queryRawUnsafe(
      `SELECT * FROM tenants WHERE slug = $1 LIMIT 1;`, slug,
    ) as Record<string, unknown>[];
    if (existingRows.length === 0) {
      return jsonError(`Tenant "${slug}" not found`, 404);
    }
    const tenant = existingRows[0];

    // 2. Check for duplicate slug
    const dupRows = await db.$queryRawUnsafe(
      `SELECT id FROM tenants WHERE slug = $1 LIMIT 1;`, newSlug,
    ) as { id: string }[];
    if (dupRows.length > 0) {
      return jsonError(`Tenant slug "${newSlug}" already exists`, 409);
    }

    // 3. Rename Vercel project if it exists
    const vercelProjectId = tenant.vercel_project_id as string | null;
    if (vercelProjectId) {
      try {
        await renameVercelProject(vercelProjectId, newSlug);
        console.log(`[rename] Vercel project ${vercelProjectId} renamed to "${newSlug}"`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[rename] Failed to rename Vercel project: ${msg}`);
        return jsonError(`Failed to rename Vercel project: ${msg}. The DB slug was not changed.`, 500);
      }
    }

    // 4. Update app_url if it follows the {slug}.vercel.app pattern
    const oldAppUrl = tenant.app_url as string | null;
    let newAppUrl: string | null = null;
    if (oldAppUrl && oldAppUrl === `https://${slug}.vercel.app`) {
      newAppUrl = `https://${newSlug}.vercel.app`;
    }

    // 5. Update DB record — change slug, app_url, and set status to 'deploying'
    if (newAppUrl) {
      await db.$executeRawUnsafe(
        `UPDATE tenants SET slug = $1, app_url = $2, status = 'deploying', updated_at = CURRENT_TIMESTAMP WHERE slug = $3;`,
        newSlug, newAppUrl, slug,
      );
    } else {
      await db.$executeRawUnsafe(
        `UPDATE tenants SET slug = $1, status = 'deploying', updated_at = CURRENT_TIMESTAMP WHERE slug = $2;`,
        newSlug, slug,
      );
    }

    // 6. Fetch and return updated tenant
    const updatedRows = await db.$queryRawUnsafe(
      `SELECT * FROM tenants WHERE slug = $1 LIMIT 1;`, newSlug,
    ) as Record<string, unknown>[];
    const updated = updatedRows[0];

    console.log(`[rename] Tenant "${slug}" renamed to "${newSlug}"`);

    return jsonOk({
      tenant: mapTenantRow(updated),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[rename] POST /${slug} error:`, msg);
    return jsonError(`Failed to rename tenant: ${msg}`, 500);
  }
}
