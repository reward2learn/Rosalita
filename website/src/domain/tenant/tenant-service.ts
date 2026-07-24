/**
 * Tenant Registry Service — DB table lifecycle & migration.
 * Uses the same idempotent pattern as app-settings-service.
 */
import type { DbClient } from '@/lib/db';

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
