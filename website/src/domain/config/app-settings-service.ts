import type { DbClient } from '@/lib/db';

const APP_SETTINGS_ID = 'default';

const APP_SETTINGS_DDL = `
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  brand_logo_text TEXT NOT NULL DEFAULT '',
  brand_logo_url TEXT NOT NULL DEFAULT '',
  brand_primary_color TEXT NOT NULL DEFAULT '#eb3d28',
  brand_secondary_color TEXT NOT NULL DEFAULT '#0af9fe',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export interface AppSettingsDto {
  webSearchEnabled: boolean;
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
}

export async function getAppSettings(db: DbClient): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const existing = await db.appSetting.findUnique({ where: { id: APP_SETTINGS_ID } });
  if (existing) {
    return {
      webSearchEnabled: existing.webSearchEnabled,
      brandLogoText: (existing as Record<string, unknown>).brandLogoText as string ?? '',
      brandLogoUrl: (existing as Record<string, unknown>).brandLogoUrl as string ?? '',
      brandPrimaryColor: (existing as Record<string, unknown>).brandPrimaryColor as string ?? '#eb3d28',
      brandSecondaryColor: (existing as Record<string, unknown>).brandSecondaryColor as string ?? '#0af9fe',
      updatedAt: existing.updatedAt,
    };
  }

  const created = await db.appSetting.create({
    data: { id: APP_SETTINGS_ID },
  });

  return {
    webSearchEnabled: created.webSearchEnabled,
    brandLogoText: (created as Record<string, unknown>).brandLogoText as string ?? '',
    brandLogoUrl: (created as Record<string, unknown>).brandLogoUrl as string ?? '',
    brandPrimaryColor: (created as Record<string, unknown>).brandPrimaryColor as string ?? '#eb3d28',
    brandSecondaryColor: (created as Record<string, unknown>).brandSecondaryColor as string ?? '#0af9fe',
    updatedAt: created.updatedAt,
  };
}

export async function updateAppSettings(
  db: DbClient,
  patch: {
    webSearchEnabled?: boolean;
    brandLogoText?: string;
    brandLogoUrl?: string;
    brandPrimaryColor?: string;
    brandSecondaryColor?: string;
  },
): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  // Use raw SQL so we don't depend on Prisma types for the new columns
  const sets: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (patch.webSearchEnabled !== undefined) {
    sets.push(`web_search_enabled = $${idx++}`);
    params.push(patch.webSearchEnabled);
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

  if (sets.length > 0) {
    sets.push(`updated_at = CURRENT_TIMESTAMP`);
    const sql = `UPDATE app_settings SET ${sets.join(', ')} WHERE id = $${idx}`;
    params.push(APP_SETTINGS_ID);
    await db.$executeRawUnsafe(sql, ...params);
  }

  // Read back the full row
  const row = await db.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT web_search_enabled, brand_logo_text, brand_logo_url, brand_primary_color, brand_secondary_color, updated_at FROM app_settings WHERE id = $1`,
    APP_SETTINGS_ID,
  );

  return {
    webSearchEnabled: Boolean(row[0]?.web_search_enabled ?? false),
    brandLogoText: String(row[0]?.brand_logo_text ?? ''),
    brandLogoUrl: String(row[0]?.brand_logo_url ?? ''),
    brandPrimaryColor: String(row[0]?.brand_primary_color ?? '#eb3d28'),
    brandSecondaryColor: String(row[0]?.brand_secondary_color ?? '#0af9fe'),
    updatedAt: new Date(row[0]?.updated_at as string ?? Date.now()),
  };
}
