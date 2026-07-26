/**
 * Neon Database Provisioning — POST /api/admin/tenants/[slug]/provision/neon
 *
 * Standalone endpoint to provision an isolated Neon Postgres branch for a tenant.
 * Creates a new branch off main, creates a database, and returns connection strings.
 *
 * Response includes all connection string variants matching the format:
 *   neon-{slug} successfully connected to {project}
 *   DATABASE_URL=...
 *   DATABASE_URL_UNPOOLED=...
 *   PGHOST=...
 *   ...
 */
import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { createClient } from '@/lib/db';
import { provisionTenantDatabase } from '@/domain/tenant/neon-provision-service';
import { formatNeonConnectionStrings, formatNeonOutput } from '@/domain/tenant/neon-output-formatter';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 min — Neon branch creation can take time

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;

  try {
    // 1. Provision the database
    const neonDb = await provisionTenantDatabase(slug);

    // 2. Format the connection strings
    const formatted = formatNeonConnectionStrings(neonDb, slug);
    const prettyOutput = formatNeonOutput(neonDb, slug);

    // 3. Update tenant record with DB URL
    const db = createClient();
    await db.tenant.update({
      where: { slug },
      data: {
        dbUrl: neonDb.pooledUrl,
        status: 'draft',
        updatedAt: new Date(),
      },
    });

    // 4. Return the full result
    return jsonOk({
      success: true,
      slug,
      branchId: neonDb.branchId,
      databaseName: neonDb.databaseName,
      branchName: `tenant-${slug}`,
      // Full formatted output (like Vercel CLI)
      formatted: prettyOutput,
      // Individual env vars (for programmatic consumption)
      envVars: formatted.envVars,
      // Raw connection strings
      pooledUrl: neonDb.pooledUrl,
      directUrl: neonDb.directUrl,
      // All Neon connection string variants
      connectionStrings: {
        DATABASE_URL: formatted.envVars.DATABASE_URL,
        DATABASE_URL_UNPOOLED: formatted.envVars.DATABASE_URL_UNPOOLED,
        PGHOST: formatted.envVars.PGHOST,
        PGHOST_UNPOOLED: formatted.envVars.PGHOST_UNPOOLED,
        PGUSER: formatted.envVars.PGUSER,
        PGDATABASE: formatted.envVars.PGDATABASE,
        PGPASSWORD: formatted.envVars.PGPASSWORD,
        POSTGRES_URL: formatted.envVars.POSTGRES_URL,
        POSTGRES_URL_NON_POOLING: formatted.envVars.POSTGRES_URL_NON_POOLING,
        POSTGRES_USER: formatted.envVars.POSTGRES_USER,
        POSTGRES_HOST: formatted.envVars.POSTGRES_HOST,
        POSTGRES_PASSWORD: formatted.envVars.POSTGRES_PASSWORD,
        POSTGRES_DATABASE: formatted.envVars.POSTGRES_DATABASE,
        POSTGRES_URL_NO_SSL: formatted.envVars.POSTGRES_URL_NO_SSL,
        POSTGRES_PRISMA_URL: formatted.envVars.POSTGRES_PRISMA_URL,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provision:neon] Failed for ${slug}:`, message);
    return jsonError(`Neon database provisioning failed: ${message}`, 500);
  }
}
