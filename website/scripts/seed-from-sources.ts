/**
 * P6 seed CLI — thin wrapper around shared seed runner.
 *
 * Usage:
 *   bun run seed              # writes when POSTGRES_URL is set
 *   bun run seed -- --dry-run   # parse/validate only, no DB writes
 */
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { seedFromSources } from '../src/domain/seed/seed-runner.ts';

const isMain =
  process.argv[1] != null &&
  fileURLToPath(import.meta.url) === resolve(process.argv[1]);

if (isMain) {
  const dryRun = process.argv.includes('--dry-run');
  seedFromSources({ dryRun })
    .then((result) => {
      console.log('[seed] Summary:', JSON.stringify(result.counts));
      console.log('[seed] Files used:', JSON.stringify(result.filesUsed));
    })
    .catch((err: unknown) => {
      console.error('[seed] Fatal:', err);
      process.exit(1);
    });
}

export { seedFromSources } from '../src/domain/seed/seed-runner.ts';
export type { SeedCounts, SeedOptions, SeedResult } from '../src/domain/seed/seed-runner.ts';
