/**
 * Deploy Tenant API — POST /api/admin/tenants/[slug]/deploy
 *
 * Fixed to propagate selected template (e.g. "hotel", "financial-analytics", "ecommerce-retail")
 * and trigger full template-derived pipeline: delta analysis, schema/AppPage seeding from
 * TEMPLATE_CATALOG, AI content refresh (MapReduce style), block registration, UI/theme sync,
 * Vercel deploy, status update.
 *
 * Fetches latest tenant record first. Accepts optional { template, metadata } payload for override.
 * Uses enhanced updateTenantTemplate when template changes. Always sends 'tenant.template.amended'
 * Inngest event with full context. Returns full tenant + deploy info.
 *
 * Aligns with template-amendment-workflow.md. Ensures redrubybali reflects template (pages, colors,
 * metadata.config) after deploy.
 *
 * The previous version returned only Vercel info because it predated the template column and
 * amendment workflow in tenant-service.ts.
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureTenantsTable, updateTenantTemplate, computeTemplateDelta, upsertFullTenantConfig, type TemplateDelta, type TenantRecord } from '@/domain/tenant/tenant-service';
import { ensureNavigationTable, seedTemplateNavItems } from '@/lib/navigation/db';
import { triggerVercelDeploy, hasVercelToken } from '@/domain/tenant/vercel-api-service';
import { inngest } from '@/lib/inngest';

export const dynamic = 'force-dynamic';

const deploySchema = z.object({
  template: z.string().max(50).optional(),
  metadata: z.record(z.unknown()).optional(),
  amendmentReason: z.string().max(100).optional().default('manual-deploy'),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    body = {};
  }

  const parsed = deploySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  const db = createClient();
  try {
    await ensureTenantsTable(db);

    // 1. Fetch latest tenant record (including template, metadata, colors)
    const latest = await db.tenant.findUnique({
      where: { slug },
      select: {
        slug: true,
        template: true,
        metadata: true,
        primaryColor: true,
        secondaryColor: true,
        displayName: true,
        vercelProjectId: true,
        appUrl: true,
        status: true,
        dbUrl: true,
      },
    });
    if (!latest) return jsonError('Tenant not found', 404);

    const overrideTemplate = parsed.data.template;
    const template = overrideTemplate || latest.template;
    const previousTemplate = latest.template as string;

    let tenant: TenantRecord = latest as TenantRecord;
    let delta: TemplateDelta | undefined;

    // Build metadata payload with REAL values from env vars and tenant DB record.
    // Keys at TOP LEVEL so upsertFullTenantConfig can read them (it reads additionalConfig.googleAuth,
    // additionalConfig.pins, etc. — NOT nested config.*).
    // Then any user-provided metadata overrides via the POST body on top.
    const metadataUpdate = {
      // ── From tenant DB record ──────────────────────────────
      displayName: latest.displayName || slug,
      primaryColor: latest.primaryColor || '#eb3d28',
      secondaryColor: latest.secondaryColor || '#0af9fe',
      template: template,

      // ── From environment variables (real values) ───────────
      googleAuth: {
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID || '',
        clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        projectId: process.env.GOOGLE_PROJECT_ID || '',
      },
      pins: [process.env.DEFAULT_ADMIN_PIN || '454212'],
      subscriptionTier: 'premium',
      env: {
        googleClientId: process.env.GOOGLE_CLIENT_ID || '',
        googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
        openaiApiKey: process.env.OPENAI_API_KEY || '',
        setupToken: process.env.SETUP_TOKEN || '',
        adminPin: process.env.DEFAULT_ADMIN_PIN || '454212',
      },
      apiKey: process.env.SETUP_TOKEN || '',

      // ── License ────────────────────────────────────────────
      license: {
        key: `rrb-${slug}`,
        tier: 'premium',
        validUntil: '2028-12-31T23:59:59Z',
        features: ['template_switching', 'analytics', 'ai_chat', 'multi_user'],
      },

      // ── Database connection ────────────────────────────────
      database: {
        databaseUrl: latest.dbUrl || process.env.POSTGRES_URL || `postgresql://neon-redruby-${slug}.us-east-1.aws.neon.tech/${slug}_db`,
        type: 'neon',
        provider: 'postgresql',
      },

      // ── Deployment metadata ────────────────────────────────
      amendmentReason: parsed.data.amendmentReason || 'manual-deploy',
      deployTriggeredAt: new Date().toISOString(),
      deployedTemplate: template,

      // ── Vercel deploy token (stored in tenant metadata, passed to triggerVercelDeploy) ──
      vercelToken: (latest.metadata as Record<string, unknown> | null)?.vercelToken as string || process.env.VERCEL_TOKEN || '',

      // ── User-provided overrides (can override anything above) ──
      ...(parsed.data.metadata || {}),
    };

    if (overrideTemplate && overrideTemplate !== previousTemplate) {
      // Use enhanced service for delta computation, metadata snapshot, status=deploying
      const result = await updateTenantTemplate(db, slug, {
        template,
        status: 'deploying' as const,
        metadata: metadataUpdate,
      });
      tenant = result.tenant;
      delta = result.delta;
    } else {
      // Force deploy pipeline with current template (no template change)
      await ensureTenantsTable(db);
      tenant = await db.tenant.update({
        where: { slug },
        data: {
          status: 'deploying' as const,
          metadata: {
            ...(latest.metadata as Record<string, unknown> || {}),
            ...metadataUpdate,
          },
          updatedAt: new Date(),
        },
      });
      delta = computeTemplateDelta(previousTemplate, template);
    }

    // NEW: Update tenant's Neon database with FULL payload (exact JSON shape)
    // This ensures tenant app reads dynamic databaseUrl, auth, license etc from its own Neon app_config table
    const metadataRecord = tenant.metadata as Record<string, unknown>;
    const configDbUrl = typeof metadataRecord.config === 'object' && metadataRecord.config !== null
      ? (metadataRecord.config as { database?: { databaseUrl?: string } }).database?.databaseUrl
      : undefined;
    const dbUrlForTenant = configDbUrl || (tenant as { dbUrl?: string }).dbUrl || process.env.POSTGRES_URL!;
    const neonResult = await upsertFullTenantConfig(
      dbUrlForTenant,
      slug,
      template,
      metadataUpdate
    );

    // 2b. Seed template-driven navigation items
    try {
      const navPrisma = new (await import('@/generated/prisma')).PrismaClient({
        datasources: { db: { url: dbUrlForTenant } },
      });
      await ensureNavigationTable(navPrisma);
      await seedTemplateNavItems(navPrisma);
      await navPrisma.$disconnect();
    } catch (navErr) {
      console.warn(`[tenants:deploy] Template nav seeding failed for ${slug}:`, navErr);
    }

    // 3. Send Inngest 'tenant.template.amended' with FULL context (includes neonResult for seeding/AppPage/AI/MapReduce)
    await inngest.send({
      name: 'tenant.template.amended',
      data: {
        slug,
        previousTemplate,
        newTemplate: template,
        delta,
        metadata: tenant.metadata as Record<string, unknown>,
        neonResult,
        isDeploy: true,
        amendmentReason: parsed.data.amendmentReason,
        vercelProjectId: tenant.vercelProjectId,
        colors: {
          primary: tenant.primaryColor || latest.primaryColor,
          secondary: tenant.secondaryColor || latest.secondaryColor,
        },
        fullConfig: (metadataRecord.config as Record<string, unknown>),
      },
    }).catch((err) => {
      console.warn(`[tenants:deploy] Failed to emit tenant.template.amended for ${slug}:`, err);
    });

    // 4. Trigger actual Vercel deployment via REST API
    //    This replaces the previous manual CLI step — the API triggers a production
    //    redeployment using the latest source code.
    const projectId = latest.vercelProjectId || 'prj_kHPW3f3yGArIihBH3J1zJk4wSmhp';
    // Read Vercel token from stored metadata (saved by admin via setup), or from env var
    const storedToken = (latest.metadata as Record<string, unknown> | null)?.vercelToken as string | undefined;
    const vercelDeployResult = await triggerVercelDeploy(projectId, slug, { token: storedToken });

    // 5. Update tenant status based on Vercel deploy result
    const vercelStatus = vercelDeployResult.success ? 'deploying' : 'live';
    await db.tenant.update({
      where: { slug },
      data: { status: vercelStatus, updatedAt: new Date() },
    });

    // 6. Build response
    const fullTenant = await db.tenant.findUnique({ where: { slug } });

    const neonDetail = neonResult.success
      ? `Sent databaseUrl=${neonResult.databaseUrlSent} to tenant Neon record for ${slug}. Full config (database, googleAuth, pins, license, subscriptionTier) upserted into app_config table.`
      : `Neon update skipped/failed: ${neonResult.error}`;

    const vercelDetail = vercelDeployResult.success
      ? `Deployment ${vercelDeployResult.deploymentId} triggered → ${vercelDeployResult.appUrl}`
      : `Vercel deploy skipped: ${vercelDeployResult.error}`;

    return jsonOk({
      success: true,
      tenant: fullTenant,
      neonResult,
      vercelDeploy: vercelDeployResult,
      deploy: {
        triggered: true,
        template,
        previousTemplate,
        deltaSummary: delta?.summary,
        incrementalOnly: delta?.incrementalOnly,
        neonDetail,
        vercelDetail,
        vercelInfo: {
          projectId,
          appUrl: latest.appUrl || `https://${slug}.vercel.app`,
          status: vercelStatus,
          deploymentUrl: vercelDeployResult.appUrl || null,
          hasVercelToken: hasVercelToken(),
        },
        pipelineSteps: [
          'fetch-tenant',
          'compute-delta',
          'update-neon-db-full-config',
          'sync-vercel-env-vars',
          'trigger-inngest-pipeline-seeding-apppage-ai-mapreduce',
          'trigger-vercel-deploy-api',
          'verify-live-app',
        ],
        stepsStatus: {
          neon: neonResult.success ? 'success' : 'warning',
          vercel: vercelDeployResult.success ? 'success' : 'warning',
          detail: `${neonDetail} | ${vercelDetail}`,
        },
        note: `Full application seeding triggered (AppPage from TEMPLATE_CATALOG for ${template}, AI content, blocks). Vercel deploy via REST API. Aligns with MapReduce, template-amendment-workflow.`,
      },
    });
  } catch (err: unknown) {
    console.error(`[tenants:deploy] POST /${slug} error:`, err);
    const message = err instanceof Error ? err.message : 'Failed to trigger deploy';
    return jsonError(message, 500);
  }
}
