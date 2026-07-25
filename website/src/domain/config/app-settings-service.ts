import type { DbClient } from '@/lib/db';

const APP_SETTINGS_ID = 'default';

const APP_SETTINGS_DDL = `
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  tenant_slug TEXT NOT NULL DEFAULT 'tokenizmyapp',
  tenant_display_name TEXT NOT NULL DEFAULT '',
  tenant_template TEXT NOT NULL DEFAULT 'default',
  tenant_metadata JSONB DEFAULT '{}',
  brand_logo_text TEXT NOT NULL DEFAULT '',
  brand_logo_url TEXT NOT NULL DEFAULT '',
  brand_primary_color TEXT NOT NULL DEFAULT '#eb3d28',
  brand_secondary_color TEXT NOT NULL DEFAULT '#0af9fe',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export interface AppSettingsDto {
  webSearchEnabled: boolean;
  tenantSlug: string;
  tenantDisplayName: string;
  tenantTemplate: string;
  tenantMetadata: Record<string, unknown>;
  brandLogoText: string;
  brandLogoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  updatedAt: Date;
}

export async function ensureAppSettingsTable(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(APP_SETTINGS_DDL);

  // Migrate: add columns if they don't exist (idempotent for existing deployments)
  const migrationCols = [
    'ADD COLUMN IF NOT EXISTS tenant_slug TEXT NOT NULL DEFAULT \'tokenizmyapp\'',
    'ADD COLUMN IF NOT EXISTS tenant_display_name TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS tenant_template TEXT NOT NULL DEFAULT \'default\'',
    'ADD COLUMN IF NOT EXISTS tenant_metadata JSONB DEFAULT \'{}\'',
    'ADD COLUMN IF NOT EXISTS brand_logo_text TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS brand_logo_url TEXT NOT NULL DEFAULT \'\'',
    'ADD COLUMN IF NOT EXISTS brand_primary_color TEXT NOT NULL DEFAULT \'#eb3d28\'',
    'ADD COLUMN IF NOT EXISTS brand_secondary_color TEXT NOT NULL DEFAULT \'#0af9fe\'',
  ];
  for (const col of migrationCols) {
    try {
      await db.$executeRawUnsafe(`ALTER TABLE app_settings ${col}`);
    } catch {
      // column may already exist — ignore
    }
  }

  // Ensure index on tenant_slug for multi-tenant lookups
  try {
    await db.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_slug ON app_settings(tenant_slug);'
    );
  } catch {
    // index may already exist
  }
}

/**
 * Get app settings for a specific tenant.
 * @param tenantSlug - tenant slug used as the row ID. Falls back to 'default' if not provided.
 */
export async function getAppSettings(db: DbClient, tenantSlug?: string): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const id = tenantSlug ?? APP_SETTINGS_ID;

  const existing = await db.appSetting.findUnique({ where: { id } });
  if (existing) {
    const ex = existing as Record<string, unknown>;
    return {
      webSearchEnabled: existing.webSearchEnabled,
      tenantSlug: String(ex.tenantSlug ?? ex.tenant_slug ?? 'tokenizmyapp'),
      tenantDisplayName: String(ex.tenantDisplayName ?? ex.tenant_display_name ?? ''),
      tenantTemplate: String(ex.tenantTemplate ?? ex.tenant_template ?? 'default'),
      tenantMetadata: (ex.tenantMetadata ?? ex.tenant_metadata ?? {}) as Record<string, unknown>,
      brandLogoText: String(ex.brandLogoText ?? ex.brand_logo_text ?? ''),
      brandLogoUrl: String(ex.brandLogoUrl ?? ex.brand_logo_url ?? ''),
      brandPrimaryColor: String(ex.brandPrimaryColor ?? ex.brand_primary_color ?? '#eb3d28'),
      brandSecondaryColor: String(ex.brandSecondaryColor ?? ex.brand_secondary_color ?? '#0af9fe'),
      updatedAt: existing.updatedAt,
    };
  }

  // Create a new row for this tenant
  const created = await db.appSetting.create({
    data: { id, tenantSlug: tenantSlug ?? 'tokenizmyapp' },
  });
  const cr = created as Record<string, unknown>;

  return {
    webSearchEnabled: created.webSearchEnabled,
    tenantSlug: String(cr.tenantSlug ?? cr.tenant_slug ?? 'tokenizmyapp'),
    tenantDisplayName: String(cr.tenantDisplayName ?? cr.tenant_display_name ?? ''),
    tenantTemplate: String(cr.tenantTemplate ?? cr.tenant_template ?? 'default'),
    tenantMetadata: (cr.tenantMetadata ?? cr.tenant_metadata ?? {}) as Record<string, unknown>,
    brandLogoText: String(cr.brandLogoText ?? cr.brand_logo_text ?? ''),
    brandLogoUrl: String(cr.brandLogoUrl ?? cr.brand_logo_url ?? ''),
    brandPrimaryColor: String(cr.brandPrimaryColor ?? cr.brand_primary_color ?? '#eb3d28'),
    brandSecondaryColor: String(cr.brandSecondaryColor ?? cr.brand_secondary_color ?? '#0af9fe'),
    updatedAt: created.updatedAt,
  };
}

export async function updateAppSettings(
  db: DbClient,
  patch: {
    webSearchEnabled?: boolean;
    tenantSlug?: string;
    tenantDisplayName?: string;
    tenantTemplate?: string;
    tenantMetadata?: Record<string, unknown>;
    brandLogoText?: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
  },
  tenantSlug?: string,
): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const id = tenantSlug ?? APP_SETTINGS_ID;

  // Use raw SQL so we don't depend on Prisma types for the new columns
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (patch.webSearchEnabled !== undefined) {
    sets.push(`web_search_enabled = $${idx++}`);
    params.push(patch.webSearchEnabled);
  }
  if (patch.tenantSlug !== undefined) {
    sets.push(`tenant_slug = $${idx++}`);
    params.push(patch.tenantSlug);
  }
  if (patch.tenantDisplayName !== undefined) {
    sets.push(`tenant_display_name = $${idx++}`);
    params.push(patch.tenantDisplayName);
  }
  if (patch.tenantTemplate !== undefined) {
    sets.push(`tenant_template = $${idx++}`);
    params.push(patch.tenantTemplate);
  }
  if (patch.tenantMetadata !== undefined) {
    sets.push(`tenant_metadata = $${idx++}`);
    params.push(JSON.stringify(patch.tenantMetadata));
  }
  if (patch.brandLogoText !== undefined) {
    sets.push(`brand_logo_text = $${idx++}`);
    params.push(patch.brandLogoText);
  }
  if (patch.brandLogoUrl !== undefined) {
    sets.push(`brand_logo_url = $${idx++}`);
    params.push(patch.brandLogoUrl);
  }
  if (patch.brandPrimaryColor !== undefined) {
    sets.push(`brand_primary_color = $${idx++}`);
    params.push(patch.brandPrimaryColor);
  }
  if (patch.brandSecondaryColor !== undefined) {
    sets.push(`brand_secondary_color = $${idx++}`);
    params.push(patch.brandSecondaryColor);
  }

  // UPSERT: insert row if it doesn't exist, then update
  if (sets.length === 0) {
    // Nothing to update — just read back
    return getAppSettings(db, tenantSlug);
  }

  sets.push(`updated_at = CURRENT_TIMESTAMP`);

  // First ensure a row exists for this tenant
  await db.$executeRawUnsafe(
    `INSERT INTO app_settings (id, tenant_slug) VALUES ($1, COALESCE($2, $1))
     ON CONFLICT (id) DO NOTHING;`,
    id, tenantSlug ?? null,
  );

  // Then update
  const sql = `UPDATE app_settings SET ${sets.join(', ')} WHERE id = $${idx}`;
  params.push(id);
  await db.$executeRawUnsafe(sql, ...params);

  // Read back the full row
  const row = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT web_search_enabled, tenant_slug, tenant_display_name, tenant_template, tenant_metadata, brand_logo_text, brand_logo_url, brand_primary_color, brand_secondary_color, updated_at FROM app_settings WHERE id = $1`,
    id,
  );

  return {
    webSearchEnabled: Boolean(row[0]?.web_search_enabled ?? false),
    tenantSlug: String(row[0]?.tenant_slug ?? 'tokenizmyapp'),
    tenantDisplayName: String(row[0]?.tenant_display_name ?? ''),
    tenantTemplate: String(row[0]?.tenant_template ?? 'default'),
    tenantMetadata: (row[0]?.tenant_metadata ?? {}) as Record<string, unknown>,
    brandLogoText: String(row[0]?.brand_logo_text ?? ''),
    brandLogoUrl: String(row[0]?.brand_logo_url ?? ''),
    brandPrimaryColor: String(row[0]?.brand_primary_color ?? '#eb3d28'),
    brandSecondaryColor: String(row[0]?.brand_secondary_color ?? '#0af9fe'),
    updatedAt: new Date(row[0]?.updated_at as string ?? Date.now()),
  };
}
