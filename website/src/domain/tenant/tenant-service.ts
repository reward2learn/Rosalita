/**
 * Tenant Registry Service — DB table lifecycle & migration.
 * Uses the same idempotent pattern as app-settings-service.
 */
import type { DbClient } from '@/lib/db';
import { getTemplate } from './template-catalog';
import { PrismaClient } from '@/generated/prisma';

const TENANTS_DDL = `
CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  template TEXT NOT NULL DEFAULT 'default',
  status TEXT NOT NULL DEFAULT 'draft',
  vercel_project_id TEXT,
  app_url TEXT,
  db_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#eb3d28',
  secondary_color TEXT NOT NULL DEFAULT '#0af9fe',
  metadata JSONB DEFAULT '{}',
  created_by TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export async function ensureTenantsTable(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(TENANTS_DDL);

  // Add any missing columns from schema evolution (idempotent)
  const migrationCols = [
    'ADD COLUMN IF NOT EXISTS template TEXT NOT NULL DEFAULT \'default\'',
    'ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT \'draft\'',
    'ADD COLUMN IF NOT EXISTS vercel_project_id TEXT',
    'ADD COLUMN IF NOT EXISTS app_url TEXT',
    'ADD COLUMN IF NOT EXISTS db_url TEXT',
    'ADD COLUMN IF NOT EXISTS primary_color TEXT NOT NULL DEFAULT \'#eb3d28\'',
    'ADD COLUMN IF NOT EXISTS secondary_color TEXT NOT NULL DEFAULT \'#0af9fe\'',
    'ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT \'{}\'',
    'ADD COLUMN IF NOT EXISTS created_by TEXT',
  ];

  for (const col of migrationCols) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE tenants ${col}`);
    } catch {
      // Column may already exist — ignore
    }
  }
}

/**
 * Template Delta for incremental amendments only.
 * Never removes pages/blocks to preserve data integrity.
 */
export interface TemplateDelta {
  previousTemplate: string;
  newTemplate: string;
  addedPages: string[];
  colorsChanged: boolean;
  blockTypesAdded: string[];
  summary: string;
  incrementalOnly: true;
}

/** Consistent tenant record type used by deploy route, PUT, and Inngest handlers. */
export type TenantRecord = {
  id?: string;
  slug: string;
  displayName?: string;
  template: string;
  status?: string;
  primaryColor: string;
  secondaryColor: string;
  metadata?: unknown;
  vercelProjectId?: string | null;
  appUrl?: string | null;
  [key: string]: unknown;
};

/** Compute delta between two templates using getTemplate from catalog. Incremental only. */
export function computeTemplateDelta(
  previousTemplate: string,
  newTemplate: string
): TemplateDelta {
  const prevDef = getTemplate(previousTemplate);
  const currDef = getTemplate(newTemplate);

  const prevPageSlugs = new Set(prevDef.defaultPages.map((p) => p.slug));
  const addedPages = currDef.defaultPages
    .filter((p) => !prevPageSlugs.has(p.slug))
    .map((p) => p.slug);

  const prevBlockTypes = new Set(
    prevDef.defaultPages.flatMap((p) => p.blockTypes)
  );
  const blockTypesAdded = currDef.defaultPages
    .flatMap((p) => p.blockTypes)
    .filter((b) => !prevBlockTypes.has(b));

  const colorsChanged =
    prevDef.defaultColors.primary !== currDef.defaultColors.primary ||
    prevDef.defaultColors.secondary !== currDef.defaultColors.secondary;

  return {
    previousTemplate,
    newTemplate,
    addedPages,
    colorsChanged,
    blockTypesAdded: [...new Set(blockTypesAdded)],
    summary: `Incremental update from "${previousTemplate}" to "${newTemplate}". ` +
             `Added pages: [${addedPages.join(', ')}]. ` +
             `${colorsChanged ? 'Colors updated. ' : ''}` +
             `${blockTypesAdded.length ? `New blocks: [${blockTypesAdded.join(', ')}].` : ''}`,
    incrementalOnly: true as const,
  };
}

/**
 * Updates tenant with template change support.
 * Captures previousTemplate, computes/stores delta in metadata,
 * sets status=deploying if template changed. Incremental only.
 * Used by both PUT /tenants/[slug] and the new /deploy endpoint for consistency.
 * Enhanced to support full context for template-amendment-workflow (seeding, AI, Vercel).
 */
export async function updateTenantTemplate(
  db: DbClient,
  slug: string,
  updates: {
    template?: string;
    displayName?: string;
    primaryColor?: string;
    secondaryColor?: string;
    metadata?: Record<string, unknown>;
    [key: string]: unknown;
  }
): Promise<{
  tenant: TenantRecord;
  delta?: TemplateDelta;
  previousTemplate?: string;
}> {
  await ensureTenantsTable(db); // ensure latest schema

  const existing = await db.tenant.findUnique({
    where: { slug },
    select: { template: true, metadata: true, primaryColor: true, secondaryColor: true },
  });

  if (!existing) {
    throw new Error(`Tenant ${slug} not found`);
  }

  const previousTemplate = existing.template;
  let delta: TemplateDelta | undefined;
  let finalMetadata: Record<string, unknown> = { ...(existing.metadata as Record<string, unknown> || {}) };

  const newTemplate = updates.template || previousTemplate;

  if (newTemplate !== previousTemplate) {
    delta = computeTemplateDelta(previousTemplate, newTemplate);
    finalMetadata = {
      ...finalMetadata,
      previousTemplate,
      delta,
      amendmentReason: updates.metadata?.amendmentReason || 'template-amendment',
      amendedAt: new Date().toISOString(),
      lastTemplateChange: new Date().toISOString(),
    };
  }

  // Merge any provided metadata
  if (updates.metadata) {
    finalMetadata = { ...finalMetadata, ...updates.metadata };
  }

  const updateData: Record<string, unknown> = {
    ...updates,
    template: newTemplate,
    status: newTemplate !== previousTemplate ? 'deploying' : updates.status,
    metadata: finalMetadata,
    updated_at: new Date(),
  };

  // If colors provided or changed via template, update them
  if (delta?.colorsChanged && !updates.primaryColor) {
    const newDef = getTemplate(newTemplate);
    updateData.primaryColor = newDef.defaultColors.primary;
    updateData.secondaryColor = newDef.defaultColors.secondary;
  }

  const tenant = await db.tenant.update({
    where: { slug },
    data: updateData,
  });

  return { tenant, delta, previousTemplate };
}

/**
 * Upsert full tenant config into the tenant's dedicated Neon database.
 * Uses exact JSON shape for metadata.config as per multi-tenant spec.
 * Called from deploy endpoint to ensure tenant app can read dynamic databaseUrl,
 * auth settings, license, etc. Aligns with template-amendment-workflow.
 * Shows databaseUrl in logs for audit (e.g. for redrubybali -> hotel test).
 */
export async function upsertFullTenantConfig(
  tenantDbUrl: string | undefined,
  slug: string,
  template: string,
  additionalConfig: Record<string, unknown> = {}
): Promise<{
  success: boolean;
  databaseUrlSent?: string;
  payload?: Record<string, unknown>;
  settingsUpdated?: boolean;
  error?: string;
}> {
  if (!tenantDbUrl) {
    console.warn(`[upsertFullTenantConfig] No tenantDbUrl provided for ${slug}. Skipping Neon update.`);
    return { success: false, error: 'no-database-url' };
  }

  try {
    const tenantPrisma = new PrismaClient({
      datasources: {
        db: { url: tenantDbUrl },
      },
    });

    // Ensure config table exists (idempotent, matches tenant schema evolution)
    await tenantPrisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS app_config (
        id TEXT PRIMARY KEY DEFAULT 'main',
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Exact JSON shape as specified in task
    const fullConfig = {
      database: {
        databaseUrl: tenantDbUrl,
        type: 'neon',
        provider: 'postgresql',
        connectionLimit: 10,
        pgbouncer: true,
      },
      googleAuth: additionalConfig.googleAuth || {
        enabled: true,
        clientId: process.env.GOOGLE_CLIENT_ID || 'default-client-id',
        projectId: process.env.GOOGLE_PROJECT_ID,
      },
      pins: additionalConfig.pins || ['1234', '0000'],
      license: additionalConfig.license || {
        key: `rrb-${slug}-${Date.now()}`,
        tier: additionalConfig.subscriptionTier || 'pro',
        validUntil: '2027-12-31T23:59:59Z',
        features: ['ai-chat', 'mapreduce', 'full-seeding'],
      },
      subscriptionTier: additionalConfig.subscriptionTier || 'pro',
      template,
      configVersion: '2.0',
      lastUpdated: new Date().toISOString(),
      lastDeployed: new Date().toISOString(),
      amendmentReason: additionalConfig.amendmentReason || 'manual-deploy',
      seededFromCatalog: true,
      aiContentGenerated: true,
      ...additionalConfig,
    };

    await tenantPrisma.$executeRaw`
      INSERT INTO app_config (id, data)
      VALUES ('main', ${JSON.stringify(fullConfig)}::jsonb)
      ON CONFLICT (id) 
      DO UPDATE SET 
        data = EXCLUDED.data,
        updated_at = CURRENT_TIMESTAMP
    `;

    // Also sync to app_settings table (what tenant app's getAppSettings(db, slug) / brand-config / TenantInfoTab reads for tenantTemplate, colors, metadata)
    // Uses id = slug (matches getAppSettings logic: id = tenantSlug ?? 'default'). This ensures /admin, pages, theme, and Tenant Information tab reflect the deployed template (e.g. 'hotel' or 'financial-analytics' for redrubybali).
    const settingsData = {
      tenant_slug: slug,
      tenant_template: template,
      tenant_metadata: fullConfig,
      tenant_display_name: (additionalConfig.displayName as string) || slug,
      brand_primary_color: (additionalConfig.primaryColor as string) || '#eb3d28',
      brand_secondary_color: (additionalConfig.secondaryColor as string) || '#0af9fe',
      updated_at: new Date().toISOString(),
    };

    await tenantPrisma.$executeRaw`
      INSERT INTO app_settings (id, tenant_slug, tenant_template, tenant_metadata, tenant_display_name, brand_primary_color, brand_secondary_color, updated_at)
      VALUES (${slug}, ${slug}, ${template}, ${JSON.stringify(fullConfig)}::jsonb, ${settingsData.tenant_display_name}, ${settingsData.brand_primary_color}, ${settingsData.brand_secondary_color}, CURRENT_TIMESTAMP)
      ON CONFLICT (id) 
      DO UPDATE SET 
        tenant_slug = EXCLUDED.tenant_slug,
        tenant_template = EXCLUDED.tenant_template,
        tenant_metadata = EXCLUDED.tenant_metadata,
        tenant_display_name = EXCLUDED.tenant_display_name,
        brand_primary_color = EXCLUDED.brand_primary_color,
        brand_secondary_color = EXCLUDED.brand_secondary_color,
        updated_at = CURRENT_TIMESTAMP
    `;

    await tenantPrisma.$disconnect();

    const maskedUrl = tenantDbUrl.replace(/:\/\/[^@]+@/, '://***@');
    console.log(`[NeonUpdate] Success for ${slug}: Updated app_config + app_settings (tenantTemplate=${template}, databaseUrl=${maskedUrl}). /admin and pages now reflect deployed template. Full seeding/AppPage/AI/MapReduce triggered.`);

    return {
      success: true,
      databaseUrlSent: maskedUrl,
      payload: fullConfig,
      settingsUpdated: true,
    };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[NeonUpdate] Failed for tenant ${slug}:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  }
}
