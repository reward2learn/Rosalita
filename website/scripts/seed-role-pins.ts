/**
 * Seed default role PINs into the secrets store.
 *
 * Usage (requires SETUP_TOKEN + a reachable POSTGRES_URL, or run against a live
 * deployment by setting SETUP_TOKEN and POSTGRES_URL from Vercel):
 *   bun run scripts/seed-role-pins.ts
 *
 * The PINs below are derived defaults. Rotate any of them from the Platform
 * Admin page (/admin) after first sign-in.
 */
import { setSecret } from '../src/lib/secrets';

const DEFAULT_PINS: Record<string, string> = {
  ROLE_PIN_AMA: '4271',
  ROLE_PIN_MADE: '8390',
  ROLE_PIN_LUKAS: '6154',
  ROLE_PIN_JAMES: '2083',
  ADMIN_PIN: '9042',
};

async function main() {
  for (const [key, pin] of Object.entries(DEFAULT_PINS)) {
    await setSecret(key, pin);
    console.log(`[role-pins] set ${key}`);
  }
  console.log('[role-pins] Done. Default PINs:');
  for (const [key, pin] of Object.entries(DEFAULT_PINS)) {
    console.log(`  ${key} = ${pin}`);
  }
}

main().catch((err) => {
  console.error('[role-pins] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
