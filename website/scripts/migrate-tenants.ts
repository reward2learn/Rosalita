/**
 * Migrate tenants table — creates the table if it doesn't exist.
 * Run with: bun run scripts/migrate-tenants.ts
 *
 * Requires POSTGRES_URL in environment.
 */

import { createClient } from '../src/lib/db';
import { ensureTenantsTable } from '../src/domain/tenant/tenant-service';

async function main() {
  if (!process.env.POSTGRES_URL) {
    console.error('[migrate-tenants] POSTGRES_URL is not set — skipping migration.');
    process.exit(1);
  }

  const db = createClient();
  try {
    await ensureTenantsTable(db);
    console.log('[migrate-tenants] ✅ Tenants table ready.');
  } catch (err) {
    console.error('[migrate-tenants] Migration failed:', err);
    process.exit(1);
  }
}

main();
