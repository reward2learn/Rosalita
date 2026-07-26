/**
 * Neon Output Formatter
 *
 * Takes a ProvisionedDatabase result from neon-provision-service.ts and
 * produces the full formatted output string with all connection string
 * variants (DATABASE_URL, PGHOST, POSTGRES_URL, etc.) matching the
 * format returned by Vercel CLI / Neon dashboard.
 *
 * Usage:
 *   const db = await provisionTenantDatabase('my-tenant');
 *   const output = formatNeonConnectionStrings(db, 'my-tenant');
 *   console.log(output);
 */
import type { ProvisionedDatabase } from './neon-provision-service';

// ── Types ──────────────────────────────────────────────────────

export interface NeonFormattedOutput {
  raw: string;
  branchName: string;
  databaseName: string;
  envVars: Record<string, string>;
}

// ── Connection string extraction ───────────────────────────────

/**
 * Parse a PostgreSQL connection string into its components.
 * e.g. postgresql://user:pass@host:port/db?params -> { user, password, host, port, database }
 */
function parseConnectionString(url: string): {
  user: string;
  password: string;
  host: string;
  port: string;
  database: string;
} {
  try {
    const parsed = new URL(url);
    return {
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      host: parsed.hostname,
      port: parsed.port || '5432',
      database: parsed.pathname.replace(/^\//, ''),
    };
  } catch {
    // Fallback: try regex extraction
    const match = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:/]+)(?::(\d+))?\/([^?]+)/);
    if (match) {
      return {
        user: match[1],
        password: match[2],
        host: match[3],
        port: match[4] || '5432',
        database: match[5],
      };
    }
    return { user: 'neondb_owner', password: '', host: '', port: '5432', database: 'neondb' };
  }
}

/**
 * Derive the unpooled (direct) host from a pooled host.
 * Pooled:  ep-xxx-pooler.c-12.us-east-1.aws.neon.tech
 * Direct:  ep-xxx.c-12.us-east-1.aws.neon.tech
 */
function deriveUnpooledHost(pooledHost: string): string {
  return pooledHost.replace('-pooler', '');
}

/**
 * Derive the pooled host from a direct host.
 */
function derivePooledHost(directHost: string): string {
  if (directHost.includes('-pooler')) return directHost;

  // Insert -pooler before the region segment (e.g. ".c-12.")
  const match = directHost.match(/^(ep-[^.]+)\.(c-\d+\..*)/);
  if (match) {
    return `${match[1]}-pooler.${match[2]}`;
  }

  return directHost.replace('.neon.tech', '-pooler.neon.tech');
}

/**
 * Build a Neon-formatted output string with all connection string variants.
 *
 * The output mirrors the format Vercel/Neon dashboard returns:
 *
 *   neon-{slug} successfully connected to {project}
 *   DATABASE_URL=postgresql://user:pass@pooled-host/db?params
 *   DATABASE_URL_UNPOOLED=postgresql://user:pass@direct-host/db?params
 *   PGHOST=pooled-host
 *   PGHOST_UNPOOLED=direct-host
 *   PGUSER=user
 *   PGDATABASE=database
 *   PGPASSWORD=password
 *   POSTGRES_URL=...
 *   ...
 */
export function formatNeonConnectionStrings(
  db: ProvisionedDatabase,
  slug?: string,
): NeonFormattedOutput {
  const { pooledUrl, directUrl, branchId, databaseName } = db;
  const projectName = slug || databaseName;

  // Parse the pooled URL to extract components
  const parsed = parseConnectionString(pooledUrl || directUrl);
  const pooledHost = parsed.host;
  const unpooledHost = pooledHost.includes('-pooler')
    ? deriveUnpooledHost(pooledHost)
    : pooledHost;

  // Ensure we have both URLs
  const effectivePooled = pooledUrl || directUrl.replace('.neon.tech', '-pooler.neon.tech');
  const effectiveDirect = directUrl || pooledUrl.replace('-pooler', '');

  // Build all connection string variants
  const pooledParams = 'channel_binding=require&sslmode=require';
  const directParams = 'sslmode=require';

  const databaseUrl = `${effectivePooled.includes('?') ? effectivePooled : effectivePooled + '?' + pooledParams}`;
  const databaseUrlUnpooled = `${effectiveDirect.includes('?') ? effectiveDirect : effectiveDirect + '?' + directParams}`;

  // Build the POSTGRES_* variants (matching Vercel integration format)
  const postgresUrl = databaseUrl;
  const postgresUrlNonPooling = `${effectiveDirect.includes('?') ? effectiveDirect.split('?')[0] : effectiveDirect}?channel_binding=require&sslmode=require`;
  const postgresUrlNoSsl = effectivePooled.split('?')[0];
  const postgresPrismaUrl = `${effectivePooled.split('?')[0]}?channel_binding=require&connect_timeout=15&sslmode=require`;

  const envVars: Record<string, string> = {
    DATABASE_URL: databaseUrl,
    DATABASE_URL_UNPOOLED: databaseUrlUnpooled,
    PGHOST: pooledHost,
    PGHOST_UNPOOLED: unpooledHost,
    PGUSER: parsed.user,
    PGDATABASE: parsed.database,
    PGPASSWORD: parsed.password,
    POSTGRES_URL: postgresUrl,
    POSTGRES_URL_NON_POOLING: postgresUrlNonPooling,
    POSTGRES_USER: parsed.user,
    POSTGRES_HOST: pooledHost,
    POSTGRES_PASSWORD: parsed.password,
    POSTGRES_DATABASE: parsed.database,
    POSTGRES_URL_NO_SSL: postgresUrlNoSsl,
    POSTGRES_PRISMA_URL: postgresPrismaUrl,
  };

  // Build the pretty-formatted output string
  const lines: string[] = [];
  lines.push(`${slug ? `neon-${slug}` : 'neon-tenant'} successfully connected to ${projectName}`);
  lines.push('');
  lines.push(`DATABASE_URL=${databaseUrl}`);
  lines.push('');
  lines.push('# For uses requiring a connection without pgbouncer');
  lines.push(`DATABASE_URL_UNPOOLED=${databaseUrlUnpooled}`);
  lines.push('');
  lines.push('# Parameters for constructing your own connection string');
  lines.push(`PGHOST=${pooledHost}`);
  lines.push(`PGHOST_UNPOOLED=${unpooledHost}`);
  lines.push(`PGUSER=${parsed.user}`);
  lines.push(`PGDATABASE=${parsed.database}`);
  lines.push(`PGPASSWORD=${parsed.password}`);
  lines.push('');
  lines.push('# Parameters for Vercel Postgres Templates');
  lines.push(`POSTGRES_URL=${postgresUrl}`);
  lines.push(`POSTGRES_URL_NON_POOLING=${postgresUrlNonPooling}`);
  lines.push(`POSTGRES_USER=${parsed.user}`);
  lines.push(`POSTGRES_HOST=${pooledHost}`);
  lines.push(`POSTGRES_PASSWORD=${parsed.password}`);
  lines.push(`POSTGRES_DATABASE=${parsed.database}`);
  lines.push(`POSTGRES_URL_NO_SSL=${postgresUrlNoSsl}`);
  lines.push(`POSTGRES_PRISMA_URL=${postgresPrismaUrl}`);

  const raw = lines.join('\n');

  return {
    raw,
    branchName: `tenant-${slug || databaseName}`,
    databaseName,
    envVars,
  };
}

/**
 * Format the Neon output with a fancy header for CLI display.
 */
export function formatNeonOutput(
  db: ProvisionedDatabase,
  slug: string,
): string {
  const formatted = formatNeonConnectionStrings(db, slug);

  return `
╔══════════════════════════════════════════════════════════════╗
║          Neon Postgres — Provisioned for "${slug}"            ║
╚══════════════════════════════════════════════════════════════╝

  Branch:     ${formatted.branchName}
  Database:   ${formatted.databaseName}
  Branch ID:  ${db.branchId}

────────────────────────────────────────────────────────────────
${formatted.raw}
────────────────────────────────────────────────────────────────
`;
}

/**
 * Format the Neon env vars as a block suitable for .env files.
 */
export function formatNeonEnvBlock(
  db: ProvisionedDatabase,
  slug: string,
): string {
  const formatted = formatNeonConnectionStrings(db, slug);
  const lines: string[] = [];
  lines.push(`# ── Neon Postgres — Tenant: ${slug} ─────────────────────`);
  lines.push(`# Generated: ${new Date().toISOString()}`);
  lines.push('');

  for (const [key, value] of Object.entries(formatted.envVars)) {
    lines.push(`${key}=${value}`);
  }

  return lines.join('\n');
}
