#!/usr/bin/env bun
/**
 * Tenant Provisioning CLI
 *
 * Fully automated tenant creation pipeline:
 *   1. Creates tenant record in DB
 *   2. Provisions Google Cloud OAuth credentials (gcloud CLI or REST API)
 *   3. Provisions Neon Postgres database (isolated branch)
 *   4. (Optional) Deploys to Vercel
 *   5. Outputs all connection strings and credentials
 *
 * Usage:
 *   bun run provision:tenant --slug=my-tenant --email=admin@tenant.com
 *
 * Options:
 *   --slug          Required. Tenant subdomain slug (e.g. "my-tenant")
 *   --display-name  Display name (defaults to slug)
 *   --email         Admin email for Google OAuth consent screen
 *   --template      Template ID (default: "default")
 *   --primary       Primary color hex (default: "#eb3d28")
 *   --secondary     Secondary color hex (default: "#0af9fe")
 *   --redirect-uri  Custom OAuth redirect URI (repeatable, defaults to https://{slug}.vercel.app)
 *   --logo          Path to logo image for OAuth consent screen
 *   --deploy        Also deploy to Vercel after provisioning
 *   --skip-google   Skip Google OAuth provisioning
 *   --skip-neon     Skip Neon database provisioning
 *   --json          Output as JSON
 *   --help          Show this help
 *
 * Examples:
 *   bun run provision:tenant --slug=redrubybali --email=admin@redruby.com    # Full provision
 *   bun run provision:tenant --slug=myapp --skip-google                       # DB only
 *   bun run provision:tenant --slug=myapp --deploy                           # Full + Vercel deploy
 *   bun run provision:tenant --slug=myapp --json                             # JSON output
 */
import { parseArgs } from 'node:util';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

// ── CLI args ───────────────────────────────────────────────────

interface CliArgs {
  slug: string;
  displayName: string;
  email: string;
  template: string;
  primaryColor: string;
  secondaryColor: string;
  redirectUris: string[];
  logoPath?: string;
  deploy: boolean;
  skipGoogle: boolean;
  skipNeon: boolean;
  jsonOutput: boolean;
}

function parseCliArgs(): CliArgs {
  const args = process.argv.slice(2);

  const getValue = (flag: string, short?: string): string | undefined => {
    for (let i = 0; i < args.length; i++) {
      if (args[i] === `--${flag}` || (short && args[i] === `-${short}`)) {
        return args[i + 1];
      }
      if (args[i].startsWith(`--${flag}=`)) {
        return args[i].split('=')[1];
      }
    }
    return undefined;
  };

  const hasFlag = (flag: string): boolean => {
    return args.includes(`--${flag}`) || args.includes(`--no-${flag}`);
  };

  if (hasFlag('help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const slug = getValue('slug') || getValue('s');
  if (!slug) {
    console.error('❌ --slug is required');
    console.error('Usage: bun run provision:tenant --slug=my-tenant --email=admin@tenant.com');
    process.exit(1);
  }

  const displayName = getValue('display-name') || getValue('n') || slug;
  const email = getValue('email') || getValue('e') || 'admin@tokenizmyapp.com';
  const template = getValue('template') || getValue('t') || 'default';
  const primaryColor = getValue('primary') || '#eb3d28';
  const secondaryColor = getValue('secondary') || '#0af9fe';
  const logoPath = getValue('logo') || getValue('l');

  // Collect redirect URIs
  const redirectUris: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--redirect-uri' || args[i] === '-r') {
      redirectUris.push(args[i + 1]);
      i++;
    }
    if (args[i].startsWith('--redirect-uri=')) {
      redirectUris.push(args[i].split('=')[1]);
    }
  }
  // Default redirect URIs
  if (redirectUris.length === 0) {
    redirectUris.push(`https://${slug}.vercel.app`);
    redirectUris.push(`https://${slug}.vercel.app/api/auth/callback/google`);
  }

  return {
    slug,
    displayName,
    email,
    template,
    primaryColor,
    secondaryColor,
    redirectUris,
    logoPath,
    deploy: hasFlag('deploy'),
    skipGoogle: hasFlag('skip-google'),
    skipNeon: hasFlag('skip-neon'),
    jsonOutput: hasFlag('json'),
  };
}

function printHelp(): void {
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║           TOKENIZMYAPP — Tenant Provisioning CLI                     ║
╚══════════════════════════════════════════════════════════════════════╝

  Creates a fully provisioned tenant with Google OAuth, Neon Postgres,
  and optional Vercel deployment.

  Usage:
    bun run provision:tenant --slug=<slug> [options]

  Required:
    --slug=<slug>         Tenant subdomain slug (e.g. "my-tenant")

  Optional:
    --display-name=<name> Display name (defaults to slug)
    --email=<email>       Admin email for OAuth consent screen
    --template=<id>       Template ID (default: "default")
    --primary=<hex>       Primary color (default: "#eb3d28")
    --secondary=<hex>     Secondary color (default: "#0af9fe")
    --redirect-uri=<url>  OAuth redirect URI (repeatable)
    --logo=<path>         Logo image path for OAuth consent screen
    --deploy              Also trigger Vercel deployment
    --skip-google         Skip Google OAuth provisioning
    --skip-neon           Skip Neon DB provisioning
    --json                Output as JSON

  Examples:
    bun run provision:tenant --slug=redrubybali --email=admin@redruby.com
    bun run provision:tenant --slug=myapp --deploy --template=restaurant
    bun run provision:tenant --slug=myapp --skip-google --json
`);
}

// ── Main provisioning pipeline ────────────────────────────────

interface ProvisionResult {
  slug: string;
  displayName: string;
  success: boolean;
  tenant: Record<string, unknown> | null;
  googleOAuth: Record<string, unknown> | null;
  neonDb: Record<string, unknown> | null;
  vercel: Record<string, unknown> | null;
  steps: Array<{ name: string; status: string; duration: number; error?: string }>;
  envVars: Record<string, string>;
  timestamp: string;
}

async function main(): Promise<void> {
  const config = parseCliArgs();
  const startedAt = Date.now();
  const steps: ProvisionResult['steps'] = [];

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║           TOKENIZMYAPP — Tenant Provisioning Pipeline                ║
╠══════════════════════════════════════════════════════════════════════╣
║  Tenant: ${config.slug.padEnd(62)}
║  Display: ${config.displayName.padEnd(61)}
║  Email:   ${config.email.padEnd(62)}
║  Template: ${config.template.padEnd(61)}
╚══════════════════════════════════════════════════════════════════════╝
`);

  const result: ProvisionResult = {
    slug: config.slug,
    displayName: config.displayName,
    success: false,
    tenant: null,
    googleOAuth: null,
    neonDb: null,
    vercel: null,
    steps: [],
    envVars: {},
    timestamp: new Date().toISOString(),
  };

  // Collect all env vars from provisioning
  const allEnvVars: Record<string, string> = {};

  try {
    // ══════════════════════════════════════════════════════════════
    // STEP 1: Create tenant in database
    // ══════════════════════════════════════════════════════════════
    const step1Start = Date.now();
    console.log('📋 Step 1/4: Creating tenant record in database...');

    try {
      // Use raw SQL to bypass ZenStack policies (CLI has no auth session)
      const { createBaseClient } = await import('@/lib/db');
      const { ensureTenantsTable } = await import('@/domain/tenant/tenant-service');

      const db = createBaseClient();
      await ensureTenantsTable(db);

      // Check if tenant already exists (raw SQL to bypass ZenStack policy)
      const existing = await db.$queryRawUnsafe(
        'SELECT id, slug, display_name, template, status, primary_color, secondary_color, db_url, app_url, vercel_project_id, metadata FROM tenants WHERE slug = $1',
        config.slug,
      ) as Array<Record<string, unknown>>;

      if (existing && existing.length > 0) {
        console.log(`  ⚠️  Tenant "${config.slug}" already exists — reusing record`);
        result.tenant = existing[0] as unknown as Record<string, unknown>;
      } else {
        const now = new Date().toISOString();
        const metadata = JSON.stringify({
          provisionedBy: 'cli',
          provisionedAt: now,
          adminEmail: config.email,
        });

        // Generate a unique ID since table has no auto-increment default
        const crypto = await import('node:crypto');
        const tenantId = crypto.randomUUID();

        await db.$executeRawUnsafe(
          `INSERT INTO tenants (id, slug, display_name, template, status, primary_color, secondary_color, metadata, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7::jsonb, 'cli-provision', $8::timestamp, $8::timestamp)`,
          tenantId,
          config.slug,
          config.displayName,
          config.template,
          config.primaryColor,
          config.secondaryColor,
          metadata,
          now,
        );

        // Fetch back the created record
        const created = await db.$queryRawUnsafe(
          'SELECT id, slug, display_name as "displayName", template, status, primary_color as "primaryColor", secondary_color as "secondaryColor", metadata FROM tenants WHERE slug = $1',
          config.slug,
        ) as Array<Record<string, unknown>>;

        result.tenant = created[0] as unknown as Record<string, unknown>;
        console.log(`  ✅ Tenant "${config.slug}" created (ID: ${created[0]?.id || 'unknown'})`);
      }

      steps.push({
        name: 'create-tenant',
        status: 'success',
        duration: Date.now() - step1Start,
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to create tenant: ${errMsg}`);
      steps.push({
        name: 'create-tenant',
        status: 'error',
        duration: Date.now() - step1Start,
        error: errMsg,
      });
      throw err;
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 2: Google Cloud OAuth
    // ══════════════════════════════════════════════════════════════
    if (!config.skipGoogle) {
      const step2Start = Date.now();
      console.log('\n🔑 Step 2/4: Provisioning Google Cloud OAuth...');

      try {
        const { provisionGoogleOAuth, formatGoogleOAuthResult, saveClientSecretJson } =
          await import('@/domain/tenant/google-cloud-service');

        const oauthResult = await provisionGoogleOAuth({
          slug: config.slug,
          displayName: config.displayName,
          redirectUris: config.redirectUris,
          adminEmail: config.email,
          logoPath: config.logoPath,
        });

        result.googleOAuth = {
          clientId: oauthResult.clientId,
          clientSecret: oauthResult.clientSecret,
          projectId: oauthResult.projectId,
          projectName: oauthResult.projectName,
          strategy: oauthResult.strategy,
        };

        // Save client_secret JSON
        await saveClientSecretJson(oauthResult);

        // Add to env vars
        allEnvVars.GOOGLE_CLIENT_ID = oauthResult.clientId;
        allEnvVars.GOOGLE_CLIENT_SECRET = oauthResult.clientSecret;
        allEnvVars.GOOGLE_PROJECT_ID = oauthResult.projectId;
        allEnvVars.GOOGLE_AUTH_URI = oauthResult.authUri;
        allEnvVars.GOOGLE_TOKEN_URI = oauthResult.tokenUri;

        // Store in DB via store-google-oauth mechanism
        try {
          const { setGoogleOAuthConfig } = await import('@/lib/auth/google-oauth');
          await setGoogleOAuthConfig({
            clientId: oauthResult.clientId,
            clientSecret: oauthResult.clientSecret,
            projectId: oauthResult.projectId,
            authUri: oauthResult.authUri,
            tokenUri: oauthResult.tokenUri,
          });
          console.log('  ✅ Google OAuth credentials stored in DB (encrypted)');
        } catch (storeErr) {
          console.warn('  ⚠️  Could not store OAuth credentials in DB (platform may not have google_oauth_config table yet):',
            storeErr instanceof Error ? storeErr.message : storeErr);
        }

        console.log(formatGoogleOAuthResult(oauthResult));
        steps.push({
          name: 'google-oauth-provision',
          status: 'success',
          duration: Date.now() - step2Start,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ Google OAuth provisioning failed: ${errMsg}`);
        steps.push({
          name: 'google-oauth-provision',
          status: 'error',
          duration: Date.now() - step2Start,
          error: errMsg,
        });
        // Non-fatal — warn but continue
        console.warn('  ⚠️  Continuing without Google OAuth. You can configure it later via the Platform Admin UI.');
      }
    } else {
      console.log('\n⏭️  Step 2/4: Skipping Google OAuth (--skip-google)');
      steps.push({
        name: 'google-oauth-provision',
        status: 'skipped',
        duration: 0,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 3: Neon Database
    // ══════════════════════════════════════════════════════════════
    if (!config.skipNeon) {
      const step3Start = Date.now();
      console.log('\n💾 Step 3/4: Provisioning Neon Postgres database...');

      try {
        const { provisionTenantDatabase } = await import('@/domain/tenant/neon-provision-service');
        const { formatNeonOutput } = await import('@/domain/tenant/neon-output-formatter');

        const db = await provisionTenantDatabase(config.slug);

        result.neonDb = {
          pooledUrl: db.pooledUrl,
          directUrl: db.directUrl,
          branchId: db.branchId,
          databaseName: db.databaseName,
        };

        // Format the output
        const formatted = formatNeonOutput(db, config.slug);
        console.log(formatted);

        // Add to env vars
        const { formatNeonConnectionStrings } = await import('@/domain/tenant/neon-output-formatter');
        const parsed = formatNeonConnectionStrings(db, config.slug);
        Object.assign(allEnvVars, parsed.envVars);

        // Save .env file for the tenant
        try {
          const { formatNeonEnvBlock } = await import('@/domain/tenant/neon-output-formatter');
          const envBlock = formatNeonEnvBlock(db, config.slug);
          const dotenvDir = join(process.cwd(), '.tenants');
          if (!existsSync(dotenvDir)) {
            await mkdir(dotenvDir, { recursive: true });
          }
          const envPath = join(dotenvDir, `${config.slug}.env`);
          await writeFile(envPath, envBlock + '\n', 'utf8');
          console.log(`  💾 Saved tenant env vars to: ${envPath}`);
        } catch (fileErr) {
          console.warn('  ⚠️  Could not save .env file:', fileErr instanceof Error ? fileErr.message : fileErr);
        }

        // Update tenant record with DB URL (raw SQL to bypass ZenStack)
        try {
          const { createBaseClient } = await import('@/lib/db');
          const dbc = createBaseClient();
          await dbc.$executeRawUnsafe(
            'UPDATE tenants SET db_url = $1, updated_at = CURRENT_TIMESTAMP WHERE slug = $2',
            db.pooledUrl,
            config.slug,
          );
          console.log('  ✅ Tenant DB URL saved to tenant record');
        } catch (updateErr) {
          console.warn('  ⚠️  Could not update tenant record with DB URL:', updateErr instanceof Error ? updateErr.message : updateErr);
        }

        steps.push({
          name: 'neon-db-provision',
          status: 'success',
          duration: Date.now() - step3Start,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ Neon provisioning failed: ${errMsg}`);
        steps.push({
          name: 'neon-db-provision',
          status: 'error',
          duration: Date.now() - step3Start,
          error: errMsg,
        });
        throw err; // DB is critical — stop here
      }
    } else {
      console.log('\n⏭️  Step 3/4: Skipping Neon database (--skip-neon)');
      steps.push({
        name: 'neon-db-provision',
        status: 'skipped',
        duration: 0,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // STEP 4: Vercel Deployment (optional)
    // ══════════════════════════════════════════════════════════════
    if (config.deploy) {
      const step4Start = Date.now();
      console.log('\n🚀 Step 4/4: Deploying to Vercel...');

      try {
        // We have two options: CLI-based deploy or API-based deploy
        const useCLI = !!process.env.VERCEL_TOKEN;

        if (useCLI) {
          const { deployViaCli } = await import('@/domain/tenant/vercel-cli-service');
          const outputDir = join(process.cwd(), '..'); // Use the website root

          const deployResult = await deployViaCli(
            outputDir,
            config.slug,
            allEnvVars,
          );

          result.vercel = {
            appUrl: deployResult.appUrl,
            projectId: deployResult.projectId,
            method: 'cli',
          };

          // Update tenant record with Vercel info (raw SQL to bypass ZenStack)
          const { createBaseClient } = await import('@/lib/db');
          const dbc = createBaseClient();
          await dbc.$executeRawUnsafe(
            'UPDATE tenants SET vercel_project_id = $1, app_url = $2, status = \'deploying\', updated_at = CURRENT_TIMESTAMP WHERE slug = $3',
            deployResult.projectId,
            deployResult.appUrl,
            config.slug,
          );

          console.log(`\n  ✅ Deployed to Vercel:`);
          console.log(`     App URL: ${deployResult.appUrl}`);
          console.log(`     Project ID: ${deployResult.projectId}`);
        } else {
          // Fallback: just create a Vercel project and provide instructions
          console.log('  ⚠️  VERCEL_TOKEN not set. Skipping automatic deployment.');
          console.log('  📝 To deploy manually:');
          console.log(`     vercel link --project=${config.slug}`);
          console.log('     Then click "Deploy" in Vercel dashboard.');

          result.vercel = {
            status: 'manual-deploy-required',
            appUrl: `https://${config.slug}.vercel.app`,
          };
        }

        steps.push({
          name: 'vercel-deploy',
          status: 'success',
          duration: Date.now() - step4Start,
        });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ❌ Vercel deployment failed: ${errMsg}`);
        steps.push({
          name: 'vercel-deploy',
          status: 'error',
          duration: Date.now() - step4Start,
          error: errMsg,
        });
        // Non-fatal — tenant is still provisioned
        console.warn('  ⚠️  Continuing without Vercel deployment. You can deploy later via the Platform Admin UI.');
      }
    } else {
      console.log('\n⏭️  Step 4/4: Skipping Vercel deploy (use --deploy to enable)');
      steps.push({
        name: 'vercel-deploy',
        status: 'skipped',
        duration: 0,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // COMPLETE: Output results
    // ══════════════════════════════════════════════════════════════

    result.success = steps.every((s) => s.status !== 'error');
    result.steps = steps;
    result.envVars = allEnvVars;

    const totalDuration = Date.now() - startedAt;
    result.timestamp = new Date().toISOString();

    if (config.jsonOutput) {
      printJsonSummary(result, allEnvVars);
    } else {
      printSummary(result, allEnvVars, totalDuration);
    }

    // Save results to file
    try {
      const outputDir = join(process.cwd(), '.tenants');
      if (!existsSync(outputDir)) {
        await mkdir(outputDir, { recursive: true });
      }
      await writeFile(
        join(outputDir, `${config.slug}-provision-result.json`),
        JSON.stringify(result, null, 2),
        'utf8',
      );
      console.log(`\n  💾 Full result saved to: ${outputDir}/${config.slug}-provision-result.json`);
    } catch { /* ignore */ }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\n❌ Provisioning failed: ${errMsg}`);
    result.success = false;
    result.steps = steps;

    if (config.jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    }
    process.exit(1);
  }
}

// ── Output formatting ──────────────────────────────────────────

function printJsonSummary(result: ProvisionResult, envVars: Record<string, string>): void {
  const output = {
    ...result,
    envVars: sanitizeEnvVars(envVars),
  };
  console.log(JSON.stringify(output, null, 2));
}

function printSummary(
  result: ProvisionResult,
  envVars: Record<string, string>,
  duration: number,
): void {
  const statusIcon = result.success ? '✅' : '⚠️';
  const statusText = result.success ? 'SUCCESS' : 'PARTIAL (some steps failed)';

  const oauthLines = result.googleOAuth
    ? `  GOOGLE_CLIENT_ID=${result.googleOAuth.clientId as string}
  GOOGLE_CLIENT_SECRET=${(result.googleOAuth.clientSecret as string).slice(0, 10)}...
  GOOGLE_PROJECT_ID=${result.googleOAuth.projectId as string}`
    : '  (not provisioned)';

  const neonLines = result.neonDb
    ? `  DATABASE_URL=${(result.neonDb.pooledUrl as string).replace(/:\/\/[^@]+@/, '://***@')}
  DATABASE_URL_UNPOOLED=${(result.neonDb.directUrl as string).replace(/:\/\/[^@]+@/, '://***@')}`
    : '  (not provisioned)';

  const vercelLines = result.vercel
    ? `  App URL:  ${(result.vercel.appUrl as string) || 'N/A'}
  Project:  ${(result.vercel.projectId as string) || 'N/A'}`
    : '  (not deployed)';

  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║  ${statusIcon}  Tenant Provisioning ${statusText.padEnd(45)}
╚══════════════════════════════════════════════════════════════════════╝

  Tenant:     ${result.slug}
  Display:    ${result.displayName}
  Duration:   ${(duration / 1000).toFixed(1)}s

  ── Steps ──────────────────────────────────────────────────`);
  for (const step of result.steps) {
    const icon = step.status === 'success' ? '✅' : step.status === 'skipped' ? '⏭️' : '❌';
    console.log(`  ${icon} ${step.name.padEnd(28)} ${step.status} (${step.duration}ms)`);
  }

  console.log(`
  ── Google OAuth ───────────────────────────────────────────
${oauthLines}

  ── Neon Postgres ──────────────────────────────────────────
${neonLines}

  ── Vercel ─────────────────────────────────────────────────
${vercelLines}

  ── Environment Variables ──────────────────────────────────`);
  for (const [key, value] of Object.entries(envVars)) {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key === 'GOOGLE_CLIENT_SECRET') {
      console.log(`  ${key}=${value.slice(0, 10)}...`);
    } else {
      console.log(`  ${key}=${value}`);
    }
  }

  console.log(`
  ── Next Steps ─────────────────────────────────────────────
  1. Set the environment variables above in your Vercel project
  2. Deploy: vercel deploy --prod
  3. Or use the Platform Admin UI: /api/admin/tenants/${result.slug}/deploy
`);
}

function sanitizeEnvVars(vars: Record<string, string>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (key.includes('SECRET') || key.includes('PASSWORD') || key === 'GOOGLE_CLIENT_SECRET') {
      sanitized[key] = value ? `${value.slice(0, 8)}...` : '';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

// ── Run ─────────────────────────────────────────────────────────

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
