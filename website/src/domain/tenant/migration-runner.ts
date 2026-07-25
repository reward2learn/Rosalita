/**
 * Migration Runner — applies a ZenStack schema to a tenant database.
 *
 * Writes the provided zmodel to a temp directory, runs `zenstack generate`
 * to produce a Prisma schema, then `prisma db push` to apply it to the
 * tenant's isolated Neon branch. The `POSTGRES_URL` env var is overridden
 * for the child processes so the Prisma datasource connects to the tenant
 * DB, not the platform DB.
 *
 * Cleanup is guaranteed via a `finally` block — temp files are removed even
 * on failure. CLI errors are captured with stderr and rethrown as clean
 * Error messages (no leaking of connection strings).
 */
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface MigrationResult {
  generatedPrismaSchema: boolean;
  pushedSchema: boolean;
  durationMs: number;
}

export interface MigrationOptions {
  /** Working directory for CLI resolution (defaults to process.cwd()). */
  cwd?: string;
  /** Per-command timeout in ms (defaults to 120s). */
  timeoutMs?: number;
}

/**
 * Run `zenstack generate` + `prisma db push` against a tenant database.
 *
 * @param databaseUrl   Direct (non-pooled) connection string for the tenant branch.
 * @param zmodelContent The ZenStack schema source to apply.
 * @returns Result flags + total duration.
 */
export async function runMigrations(
  databaseUrl: string,
  zmodelContent: string,
  options: MigrationOptions = {},
): Promise<MigrationResult> {
  if (!databaseUrl) throw new Error('runMigrations: databaseUrl is required');
  if (!zmodelContent) throw new Error('runMigrations: zmodelContent is required');

  const cwd = options.cwd ?? process.cwd();
  const timeoutMs = options.timeoutMs ?? 120_000;
  const startedAt = Date.now();

  // 1. Write the zmodel into a temp zenstack/ directory.
  const tmpDir = mkdtempSync(join(tmpdir(), 'tenant-migration-'));
  const zenstackDir = join(tmpDir, 'zenstack');
  mkdirSync(zenstackDir, { recursive: true });
  const zmodelPath = join(zenstackDir, 'schema.zmodel');
  writeFileSync(zmodelPath, zmodelContent, 'utf8');
  console.log(`[migration-runner] Wrote zmodel to ${zmodelPath}`);

  // Override DB env vars so Prisma's datasource connects to the tenant branch.
  // Both POSTGRES_URL and DATABASE_URL are set for compatibility with either
  // datasource declaration convention.
  const env = {
    ...process.env,
    POSTGRES_URL: databaseUrl,
    DATABASE_URL: databaseUrl,
    POSTGRES_URL_NON_POOLING: databaseUrl,
  };

  let generatedPrismaSchema = false;
  let pushedSchema = false;

  try {
    // 2. zenstack generate → produces <zenstackDir>/prisma/schema.prisma
    try {
      execSync(`npx zenstack generate --schema "${zmodelPath}"`, {
        cwd,
        stdio: 'pipe',
        timeout: timeoutMs,
        env,
      });
      generatedPrismaSchema = true;
      console.log('[migration-runner] zenstack generate completed');
    } catch (err) {
      throw new Error(
        `zenstack generate failed: ${extractMessage(err)}`,
      );
    }

    // 3. prisma db push → apply schema to the tenant DB
    const prismaSchemaPath = join(zenstackDir, 'prisma', 'schema.prisma');
    if (!existsSync(prismaSchemaPath)) {
      throw new Error(
        `Prisma schema was not generated at expected path: ${prismaSchemaPath}`,
      );
    }
    try {
      execSync(
        `npx prisma db push --schema "${prismaSchemaPath}" --skip-generate --accept-data-loss`,
        {
          cwd,
          stdio: 'pipe',
          timeout: timeoutMs,
          env,
        },
      );
      pushedSchema = true;
      console.log('[migration-runner] prisma db push completed');
    } catch (err) {
      throw new Error(`prisma db push failed: ${extractMessage(err)}`);
    }

    const durationMs = Date.now() - startedAt;
    console.log(`[migration-runner] Migrations applied in ${durationMs}ms`);
    return { generatedPrismaSchema, pushedSchema, durationMs };
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
    console.log('[migration-runner] Cleaned up temp dir');
  }
}

/** Extract a readable message (including stderr) from an execSync error,
 *  stripping any connection-string credentials. */
function extractMessage(err: unknown): string {
  if (err instanceof Error) {
    const stderr = readStderr(err);
    const raw = `${err.message}${stderr ? ` | stderr: ${stderr}` : ''}`;
    return raw.replace(/:\/\/[^@]+@/g, '://***:***@').slice(0, 600);
  }
  return String(err);
}

/** Read the `stderr` field from an execSync error (typed as unknown). */
function readStderr(err: Error): string {
  const stderr = (err as unknown as { stderr?: unknown }).stderr;
  return typeof stderr === 'string'
    ? stderr
    : Buffer.isBuffer(stderr)
      ? stderr.toString('utf8')
      : '';
}
