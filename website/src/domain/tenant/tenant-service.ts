/**
 * Tenant Registry Service — DB table lifecycle & migration.
 * Uses the same idempotent pattern as app-settings-service.
 */
import type { DbClient } from '@/lib/db';
import { getTemplate } from './template-catalog';

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
  tenant: { id?: string; slug: string; metadata?: unknown; [key: string]: unknown };
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
