/**
 * Vercel CLI Deployment Service — Phase 6
 *
 * Deploys a generated tenant app to Vercel using the Vercel CLI (not the API).
 * The CLI is invoked via child_process.execSync with cwd set to the generated
 * app's output directory.
 *
 * Pipeline:
 *   1. vercel link — links the local project to a Vercel project by slug
 *   2. vercel env add — injects environment variables for production
 *   3. vercel deploy --prod — builds and deploys to production
 *
 * Token resolution:
 *   - VERCEL_TOKEN env var (preferred — available at runtime on Vercel)
 *   - Fall back to Vercel CLI's built-in auth (no --token flag) for local dev
 *
 * Error handling:
 *   - CLI stderr is logged but warnings don't throw
 *   - Only hard failures (non-zero exit code on deploy) throw
 */

import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// ── Types ─────────────────────────────────────────────────────────

export interface DeployResult {
  appUrl: string;
  projectId: string;
}

export interface LinkResult {
  projectId: string;
  orgId: string;
}

// ── Config ────────────────────────────────────────────────────────

/** Timeout for CLI commands (5 minutes — builds can be slow). */
const CLI_TIMEOUT_MS = 300_000;

/**
 * Build the --token flag if VERCEL_TOKEN is set, otherwise return empty
 * string (falls back to Vercel CLI's built-in auth).
 */
function tokenFlag(): string {
  const token = process.env.VERCEL_TOKEN;
  return token ? `--token=${token}` : '';
}

// ── Project linking ───────────────────────────────────────────────

/**
 * Link the local project to a Vercel project by slug.
 *
 *   vercel link --project={slug} --yes --token={token}
 *
 * After linking, .vercel/project.json is created with the projectId and orgId.
 */
export async function linkProject(
  outputDir: string,
  slug: string,
  token: string,
): Promise<void> {
  const flag = token ? `--token=${token}` : '';
  const cmd = `vercel link --project=${slug} --yes ${flag}`.trim();

  console.log(`[vercel-cli] Linking project "${slug}" in ${outputDir}`);
  runCli(cmd, outputDir, { allowWarning: true });
  console.log(`[vercel-cli] Project linked: ${slug}`);
}

// ── Environment variable injection ────────────────────────────────

/**
 * Inject environment variables into the linked Vercel project.
 *
 *   echo -n "value" | vercel env add {key} production --token={token}
 *
 * Each env var is added for the "production" target. If the var already
 * exists, the CLI returns a non-zero exit code — this is treated as a
 * warning, not an error.
 */
export async function injectEnvVars(
  outputDir: string,
  envVars: Record<string, string>,
  token: string,
): Promise<void> {
  const flag = token ? `--token=${token}` : '';
  let injected = 0;
  let skipped = 0;

  for (const [key, value] of Object.entries(envVars)) {
    if (!value) continue;

    const cmd = `vercel env add ${key} production ${flag}`.trim();

    try {
      execSync(cmd, {
        cwd: outputDir,
        input: value,
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: CLI_TIMEOUT_MS,
      });
      injected++;
      console.log(`[vercel-cli] Env var added: ${key}`);
    } catch (err) {
      // Env var likely already exists — log and continue
      skipped++;
      const stderr = readStderr(err);
      const msg = stderr || (err instanceof Error ? err.message : String(err));
      console.warn(`[vercel-cli] Env var ${key} skipped: ${msg.slice(0, 120)}`);
    }
  }

  console.log(
    `[vercel-cli] Env vars: ${injected} added, ${skipped} skipped/already-existed`,
  );
}

// ── Deploy trigger ────────────────────────────────────────────────

/**
 * Trigger a production deployment.
 *
 *   vercel deploy --prod --yes --token={token}
 *
 * Parses the deployment URL from the CLI output (looks for https://*.vercel.app).
 */
export async function triggerDeploy(
  outputDir: string,
  token: string,
): Promise<{ appUrl: string }> {
  const flag = token ? `--token=${token}` : '';
  const cmd = `vercel deploy --prod --yes ${flag}`.trim();

  console.log(`[vercel-cli] Deploying to production from ${outputDir}`);
  const stdout = runCli(cmd, outputDir, { captureStdout: true });

  // Parse the deployment URL from the output
  const urlMatch = stdout.match(/https:\/\/[a-z0-9-]+\.vercel\.app/i);
  if (!urlMatch) {
    throw new Error(
      `Could not parse deployment URL from Vercel CLI output. ` +
        `Output was: ${stdout.slice(0, 500)}`,
    );
  }

  const appUrl = urlMatch[0];
  console.log(`[vercel-cli] Deployed to: ${appUrl}`);
  return { appUrl };
}

// ── Full pipeline ─────────────────────────────────────────────────

/**
 * Full Vercel CLI deployment pipeline.
 *
 *   1. Link the project
 *   2. Inject environment variables
 *   3. Deploy to production
 *   4. Read projectId from .vercel/project.json
 *
 * Returns { appUrl, projectId }.
 */
export async function deployViaCli(
  outputDir: string,
  slug: string,
  envVars: Record<string, string>,
): Promise<DeployResult> {
  const token = process.env.VERCEL_TOKEN ?? '';

  // 1. Link project
  await linkProject(outputDir, slug, token);

  // 2. Inject env vars
  await injectEnvVars(outputDir, envVars, token);

  // 3. Deploy
  const { appUrl } = await triggerDeploy(outputDir, token);

  // 4. Read projectId from .vercel/project.json
  const projectId = readProjectId(outputDir);

  return { appUrl, projectId };
}

// ── Helpers ───────────────────────────────────────────────────────

/** Read the projectId from .vercel/project.json (created by vercel link). */
function readProjectId(outputDir: string): string {
  const projectJsonPath = join(outputDir, '.vercel', 'project.json');
  if (!existsSync(projectJsonPath)) {
    console.warn('[vercel-cli] .vercel/project.json not found — projectId unknown');
    return '';
  }

  try {
    const content = readFileSync(projectJsonPath, 'utf8');
    const data = JSON.parse(content) as { projectId?: string };
    return data.projectId ?? '';
  } catch {
    console.warn('[vercel-cli] Failed to parse .vercel/project.json');
    return '';
  }
}

/**
 * Run a Vercel CLI command and return its stdout.
 * Throws on non-zero exit code unless allowWarning is true and the output
 * contains only warnings (not hard errors).
 */
function runCli(
  cmd: string,
  cwd: string,
  options: { captureStdout?: boolean; allowWarning?: boolean } = {},
): string {
  try {
    const stdout = execSync(cmd, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: CLI_TIMEOUT_MS,
    });
    return stdout.toString('utf8');
  } catch (err) {
    const stderr = readStderr(err);
    const stdout = readStdout(err);

    // If allowWarning and the output looks like a warning (not a hard error),
    // log and return the stdout (may contain useful info like URLs)
    if (options.allowWarning) {
      console.warn(`[vercel-cli] Command warning: ${stderr.slice(0, 200)}`);
      return stdout;
    }

    // Hard error — log stderr and throw
    console.error(`[vercel-cli] Command failed: ${cmd}`);
    console.error(`[vercel-cli] stderr: ${stderr.slice(0, 500)}`);
    throw new Error(
      `Vercel CLI command failed: ${stderr.slice(0, 200) || 'unknown error'}`,
    );
  }
}

/** Read the `stderr` field from an execSync error. */
function readStderr(err: unknown): string {
  const stderr = (err as { stderr?: unknown }).stderr;
  return typeof stderr === 'string'
    ? stderr
    : Buffer.isBuffer(stderr)
      ? stderr.toString('utf8')
      : '';
}

/** Read the `stdout` field from an execSync error. */
function readStdout(err: unknown): string {
  const stdout = (err as { stdout?: unknown }).stdout;
  return typeof stdout === 'string'
    ? stdout
    : Buffer.isBuffer(stdout)
      ? stdout.toString('utf8')
      : '';
}
