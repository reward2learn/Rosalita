/**
 * Postinstall hook — skipped on Vercel (migrations run at runtime via lib/db.js).
 * job_queue DDL is also included in lib/db.js migrate().
 */
const hasDb = Boolean(process.env.POSTGRES_URL || process.env.DATABASE_URL);

if (!hasDb) {
  console.log('[postinstall] No POSTGRES_URL — skipping job_queue setup');
  process.exit(0);
}

if (process.env.VERCEL === '1') {
  console.log('[postinstall] Vercel install — skipping job_queue setup (runs at runtime)');
  process.exit(0);
}

const { runMigrations } = await import('../lib/db.js');

try {
  await runMigrations();
  console.log('[postinstall] job_queue tables ready');
} catch (e) {
  console.warn('[postinstall] job_queue setup skipped:', e.message);
  process.exit(0);
}
