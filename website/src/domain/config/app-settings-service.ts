import type { DbClient } from '@/lib/db';

const APP_SETTINGS_ID = 'default';

const APP_SETTINGS_DDL = `
CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`;

export interface AppSettingsDto {
  webSearchEnabled: boolean;
  updatedAt: Date;
}

export async function ensureAppSettingsTable(db: DbClient): Promise<void> {
  await db.$executeRawUnsafe(APP_SETTINGS_DDL);
}

export async function getAppSettings(db: DbClient): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const existing = await db.appSetting.findUnique({ where: { id: APP_SETTINGS_ID } });
  if (existing) {
    return {
      webSearchEnabled: existing.webSearchEnabled,
      updatedAt: existing.updatedAt,
    };
  }

  const created = await db.appSetting.create({
    data: { id: APP_SETTINGS_ID },
  });

  return {
    webSearchEnabled: created.webSearchEnabled,
    updatedAt: created.updatedAt,
  };
}

export async function updateAppSettings(
  db: DbClient,
  patch: { webSearchEnabled?: boolean },
): Promise<AppSettingsDto> {
  await ensureAppSettingsTable(db);

  const updated = await db.appSetting.upsert({
    where: { id: APP_SETTINGS_ID },
    create: {
      id: APP_SETTINGS_ID,
      webSearchEnabled: patch.webSearchEnabled ?? false,
    },
    update: {
      ...(patch.webSearchEnabled !== undefined ? { webSearchEnabled: patch.webSearchEnabled } : {}),
    },
  });

  return {
    webSearchEnabled: updated.webSearchEnabled,
    updatedAt: updated.updatedAt,
  };
}
