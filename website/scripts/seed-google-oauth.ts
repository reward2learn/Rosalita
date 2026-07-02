/**
 * Seed Google OAuth credentials into google_oauth_config (encrypted client_secret).
 *
 * Usage:
 *   bun run scripts/seed-google-oauth.ts
 *   bun run scripts/seed-google-oauth.ts -- --from-json ../Google/client_secret_*.json
 *   bun run scripts/seed-google-oauth.ts -- --dry-run
 *
 * Requires: POSTGRES_URL, ENCRYPTION_KEY
 * Reads from env when flags omitted: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
 *   GOOGLE_PROJECT_ID, GOOGLE_AUTH_URI (optional)
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { encrypt } from '../src/lib/crypto.js';
import { GOOGLE_OAUTH_TABLE_DDL } from '../src/lib/auth/google-oauth.js';

const CONFIG_ID = 'default';
const DEFAULT_AUTH_URI = 'https://accounts.google.com/o/oauth2/auth';
const DEFAULT_TOKEN_URI = 'https://oauth2.googleapis.com/token';

function loadEnvLocal(): void {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const text = readFileSync(envPath, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq);
    let value = trimmed.slice(eq + 1);
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

interface GoogleWebCredentials {
  client_id: string;
  project_id: string;
  auth_uri: string;
  token_uri?: string;
  client_secret: string;
}

function parseArgs(): { fromJson?: string; dryRun: boolean } {
  const args = process.argv.slice(2);
  let fromJson: string | undefined;
  let dryRun = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--from-json' && args[i + 1]) {
      fromJson = args[++i];
    } else if (args[i] === '--dry-run') {
      dryRun = true;
    }
  }
  return { fromJson, dryRun };
}

function loadCredentials(fromJson?: string): GoogleWebCredentials {
  if (fromJson) {
    const path = resolve(process.cwd(), fromJson);
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { web?: GoogleWebCredentials };
    if (!raw.web?.client_id || !raw.web?.client_secret) {
      throw new Error(`Invalid Google credentials JSON at ${path}`);
    }
    return raw.web;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET, or pass --from-json');
  }

  return {
    client_id: clientId,
    project_id: process.env.GOOGLE_PROJECT_ID ?? '',
    auth_uri: process.env.GOOGLE_AUTH_URI ?? DEFAULT_AUTH_URI,
    token_uri: process.env.GOOGLE_TOKEN_URI ?? DEFAULT_TOKEN_URI,
    client_secret: clientSecret,
  };
}

async function main(): Promise<void> {
  loadEnvLocal();
  const { fromJson, dryRun } = parseArgs();
  const creds = loadCredentials(fromJson);

  console.log('[seed-google-oauth] client_id:', creds.client_id);
  console.log('[seed-google-oauth] project_id:', creds.project_id);
  console.log('[seed-google-oauth] auth_uri:', creds.auth_uri);

  if (!process.env.POSTGRES_URL) {
    throw new Error('POSTGRES_URL is not set');
  }
  if (!process.env.ENCRYPTION_KEY) {
    throw new Error('ENCRYPTION_KEY is not set');
  }

  if (dryRun) {
    console.log('[seed-google-oauth] --dry-run: validated credentials, skipping DB write.');
    return;
  }

  const prisma = new PrismaClient();
  try {
    await prisma.$executeRawUnsafe(GOOGLE_OAUTH_TABLE_DDL);
    const { encrypted, iv, authTag } = encrypt(creds.client_secret);
    await prisma.$executeRaw`
      INSERT INTO google_oauth_config (id, client_id, project_id, auth_uri, token_uri, encrypted_secret, iv, auth_tag)
      VALUES (
        ${CONFIG_ID},
        ${creds.client_id},
        ${creds.project_id},
        ${creds.auth_uri},
        ${creds.token_uri ?? DEFAULT_TOKEN_URI},
        ${encrypted},
        ${iv},
        ${authTag}
      )
      ON CONFLICT (id) DO UPDATE SET
        client_id = EXCLUDED.client_id,
        project_id = EXCLUDED.project_id,
        auth_uri = EXCLUDED.auth_uri,
        token_uri = EXCLUDED.token_uri,
        encrypted_secret = EXCLUDED.encrypted_secret,
        iv = EXCLUDED.iv,
        auth_tag = EXCLUDED.auth_tag,
        updated_at = NOW()
    `;
    console.log('[seed-google-oauth] Done — credentials stored (client_secret encrypted).');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('[seed-google-oauth] Fatal:', err);
  process.exit(1);
});
