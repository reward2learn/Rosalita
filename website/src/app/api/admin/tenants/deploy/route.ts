import { NextRequest } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonOk, jsonError } from '@/lib/api/response';
import { createClient } from '@/lib/db';
import { upsertFullTenantConfig } from '@/domain/tenant/tenant-service';
import { z } from 'zod';

const payloadSchema = z.object({
  displayName: z.string(),
  template: z.string(),
  status: z.string(),
  primaryColor: z.string(),
  secondaryColor: z.string(),
  metadata: z.object({
    config: z.object({
      subscriptionTier: z.string().optional(),
      licenseExpiresAt: z.string().optional(),
      googleAuth: z.record(z.any()).optional(),
      database: z.object({
        databaseUrl: z.string().optional(),
        postgresUrl: z.string().optional(),
        pgUser: z.string().optional(),
        pgPassword: z.string().optional(),
      }).optional(),
      pins: z.array(z.any()).optional(),
      envVars: z.array(z.any()).optional(),
    }).optional(),
  }).optional(),
  apiKey: z.string().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const body = await request.json();
  const parse = payloadSchema.safeParse(body);
  if (!parse.success) {
    return jsonError('Invalid tenant config payload', 400 );
  }

  const payload = parse.data;

  try {
    const db = createClient();

    // Extract DB URL from the full payload (or fallback)
    const payloadConfig = (payload.metadata as Record<string, unknown>)?.config as Record<string, unknown> | undefined;
    const dbConfig = payloadConfig?.database as Record<string, string> | undefined;
    const tenantDbUrl = dbConfig?.databaseUrl || dbConfig?.postgresUrl || process.env.POSTGRES_URL!;

    // Upsert the full config into the tenant's Neon record (exact shape from platform)
    // Signature: upsertFullTenantConfig(tenantDbUrl, slug, template, additionalConfig)
    await upsertFullTenantConfig(tenantDbUrl, 'redrubybali', payload.template || 'default', payload as unknown as Record<string, unknown>);

    // Optional: Trigger local seeding or Inngest for this tenant
    // await inngest.send({ name: 'tenant.config.synced', data: payload });

    return jsonOk({
      success: true,
      message: 'Tenant config synced from platform (full metadata.config including databaseUrl, googleAuth, pins, license)',
      received: {
        template: payload.template,
        databaseUrl: payload.metadata?.config?.database?.databaseUrl,
        subscriptionTier: payload.metadata?.config?.subscriptionTier,
      },
    });
  } catch (error: any) {
    console.error('[tenant-deploy] Sync failed', error);
    return jsonError(error.message || 'Failed to sync tenant config', 500);
  }
}
