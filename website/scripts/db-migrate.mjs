import { runMigrations } from '../lib/db.js';

try {
  await runMigrations();
  console.log('[db:migrate] Done');
} catch (err) {
  console.error('[db:migrate] Failed:', err.message);
  process.exit(1);
}
