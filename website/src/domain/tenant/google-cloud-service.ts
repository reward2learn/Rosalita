/**
 * Google Cloud Automation Service
 *
 * Provisions Google Cloud OAuth 2.0 credentials for tenants automatically.
 *
 * Two strategies (tried in order):
 *   STRATEGY_A: Google REST APIs via service account (works everywhere — Vercel, CI, local)
 *   STRATEGY_B: gcloud CLI (local dev, when gcloud is authenticated)
 *   STRATEGY_C: Pre-configured env var fallback (simplest — use GOOGLE_CLIENT_* env vars)
 *
 * Prerequisites (Strategy A):
 *   - A "parent" Google Cloud project (set via GOOGLE_CLOUD_PROJECT_ID)
 *   - A service account with roles/oauthconfig.editor + roles/cloudplatform.serviceAgent
 *     stored in secrets table as key "GOOGLE_CLOUD_SERVICE_ACCOUNT" or env var
 *     GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON
 *
 * Strategy B uses your local gcloud auth (run `gcloud auth login` once).
 * Strategy C uses the existing per-platform GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env vars.
 */
import { execSync } from 'node:child_process';
import { getSecretPlaintext } from '@/lib/secrets';

// ── Types ──────────────────────────────────────────────────────

export interface GoogleOAuthClientResult {
  clientId: string;
  clientSecret: string;
  projectId: string;
  projectName: string;
  redirectUris: string[];
  clientEmail?: string; // Tenant admin email used for consent screen
  authUri: string;
  tokenUri: string;
  /** The raw client_secret JSON (for download / store-google-oauth). */
  clientSecretJson: string;
  /** Which strategy produced the result. */
  strategy: 'rest-api' | 'gcloud-cli' | 'env-fallback' | 'pre-existing';
}

export interface GoogleProjectResult {
  projectId: string;
  projectNumber: string;
  displayName: string;
}

export interface TenantGoogleConfig {
  slug: string;
  displayName: string;
  redirectUris: string[];
  adminEmail: string;
  logoPath?: string;
}

// ── Config ─────────────────────────────────────────────────────

const OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const OAUTH_AUTH_URL = 'https://accounts.google.com/o/oauth2/auth';

/**
 * Full Google OAuth provisioning — primary entry point.
 * Tries strategies in order: A → B → C
 */
export async function provisionGoogleOAuth(
  config: TenantGoogleConfig,
): Promise<GoogleOAuthClientResult> {
  const { slug, displayName, redirectUris, adminEmail } = config;

  console.log(`[google-cloud] Provisioning OAuth for tenant "${slug}" (${displayName})`);

  // ── Strategy A: REST API via Service Account ─────────────
  const saResult = await tryStrategyServiceAccount(config);
  if (saResult) {
    console.log(`[google-cloud] Strategy A (REST API) succeeded for "${slug}"`);
    return saResult;
  }

  // ── Strategy B: gcloud CLI ──────────────────────────────
  const gcloudResult = tryStrategyGcloud(config);
  if (gcloudResult) {
    console.log(`[google-cloud] Strategy B (gcloud CLI) succeeded for "${slug}"`);
    return gcloudResult;
  }

  // ── Strategy C: Pre-existing env vars ──────────────────
  const envResult = envVarFallback(config);
  if (envResult) {
    console.log(`[google-cloud] Strategy C (env fallback) — returning existing GOOGLE_CLIENT_* for "${slug}"`);
    return envResult;
  }

  throw new Error(
    `[google-cloud] All OAuth provisioning strategies failed for "${slug}".\n` +
    `  To fix:\n` +
    `  1. Install gcloud CLI and run: gcloud auth login\n` +
    `  2. OR set up a service account: docs/tutorials/google-cloud-service-account.md\n` +
    `  3. OR manually create OAuth credentials in Google Cloud Console and set GOOGLE_CLIENT_* env vars.\n` +
    `  See: docs/knowledge-base/tenant-google-oauth-setup.md`,
  );
}

// ── Strategy A: REST API via Service Account ─────────────────

/**
 * Get a Google Cloud access token from a service account.
 * The service account JSON can come from:
 *   1. secrets table (key: "GOOGLE_CLOUD_SERVICE_ACCOUNT")
 *   2. Environment variable: GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON
 *
 * Returns null if no service account is configured.
 */
async function getServiceAccountToken(): Promise<{ accessToken: string; projectId: string } | null> {
  let saJson: string | null = null;

  // Try secrets table first
  try {
    saJson = await getSecretPlaintext('GOOGLE_CLOUD_SERVICE_ACCOUNT');
  } catch {
    // Secret might not exist — fall through
  }

  // Try env var next
  if (!saJson) {
    saJson = process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT_JSON ?? null;
  }

  if (!saJson) return null;

  try {
    const sa = JSON.parse(saJson) as {
      client_email: string;
      private_key: string;
      project_id: string;
    };

    // Create JWT assertion for OAuth2 token
    const header = { alg: 'RS256', typ: 'JWT' };
    const now = Math.floor(Date.now() / 1000);
    const claims = {
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/oauth2',
      aud: OAUTH_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    };

    const b64 = (obj: Record<string, unknown>) =>
      Buffer.from(JSON.stringify(obj)).toString('base64url');

    const payload = `${b64(header)}.${b64(claims)}`;

    // Sign with the service account's private key
    const crypto = await import('node:crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(payload);
    const signature = sign.sign(sa.private_key, 'base64url');

    const jwt = `${payload}.${signature}`;

    // Exchange JWT for access token
    const tokenRes = await fetch(OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text().catch(() => '');
      console.warn(`[google-cloud] Service account token exchange failed: ${tokenRes.status} ${errText.slice(0, 200)}`);
      return null;
    }

    const tokenData = await tokenRes.json() as { access_token: string };
    return { accessToken: tokenData.access_token, projectId: sa.project_id };
  } catch (err) {
    console.warn('[google-cloud] Service account auth failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Try provisioning via Google Cloud REST APIs + service account.
 */
async function tryStrategyServiceAccount(
  config: TenantGoogleConfig,
): Promise<GoogleOAuthClientResult | null> {
  const auth = await getServiceAccountToken();
  if (!auth) return null;

  const { slug, displayName, redirectUris, adminEmail } = config;
  const parentProjectId = process.env.GOOGLE_CLOUD_PROJECT_ID || auth.projectId;

  console.log(`[google-cloud] Using REST API with parent project: ${parentProjectId}`);

  try {
    // 1. Create a unique project for this tenant (optional — can share parent)
    const projectId = `tenant-${slug}`.replace(/[^a-z0-9-]/g, '-').slice(0, 30);
    let tenantProjectId = parentProjectId;

    if (process.env.GOOGLE_CLOUD_CREATE_PROJECTS === 'true') {
      try {
        const project = await createProject(auth.accessToken, projectId, displayName);
        tenantProjectId = project.projectId;
        console.log(`[google-cloud] Created project: ${tenantProjectId}`);
      } catch (projErr) {
        console.warn(`[google-cloud] Project creation skipped/fallback:`, projErr instanceof Error ? projErr.message : projErr);
        tenantProjectId = parentProjectId;
      }
    }

    // 2. Enable the OAuth 2.0 API on the project
    await enableOAuthApi(auth.accessToken, tenantProjectId);

    // 3. Configure OAuth consent screen
    await configureConsentScreen(auth.accessToken, tenantProjectId, {
      displayName,
      supportEmail: adminEmail,
      logoPath: config.logoPath,
    });

    // 4. Create OAuth 2.0 Web client
    const client = await createOAuthClient(auth.accessToken, tenantProjectId, {
      displayName: `${displayName} (${slug})`,
      redirectUris,
    });

    // 5. Build the client_secret JSON
    const clientSecretJson = buildClientSecretJson(client, tenantProjectId);

    return {
      clientId: client.client_id,
      clientSecret: client.client_secret,
      projectId: tenantProjectId,
      projectName: displayName,
      redirectUris,
      clientEmail: adminEmail,
      authUri: OAUTH_AUTH_URL,
      tokenUri: OAUTH_TOKEN_URL,
      clientSecretJson,
      strategy: 'rest-api',
    };
  } catch (err) {
    console.warn('[google-cloud] REST API strategy failed:', err instanceof Error ? err.message : err);
    return null;
  }
}

// ── REST API Helpers ─────────────────────────────────────────

interface GcpOAuthClientResponse {
  client_id: string;
  client_secret: string;
  display_name: string;
  redirect_uris: string[];
}

/**
 * Create a Google Cloud project.
 */
async function createProject(
  accessToken: string,
  projectId: string,
  displayName: string,
): Promise<GoogleProjectResult> {
  const res = await fetch('https://cloudresourcemanager.googleapis.com/v1/projects', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      projectId,
      name: displayName,
      labels: {
        managed_by: 'tokenizmyapp',
        tenant: projectId,
        created_by: 'provision-tenant',
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    // 409 means project already exists — that's fine
    if (res.status === 409) {
      return { projectId, projectNumber: '', displayName };
    }
    throw new Error(`createProject failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as { name: string; projectNumber: string };
  return { projectId, projectNumber: data.projectNumber, displayName };
}

/**
 * Enable the OAuth 2.0 API on a project.
 */
async function enableOAuthApi(accessToken: string, projectId: string): Promise<void> {
  const url = `https://serviceusage.googleapis.com/v1/projects/${projectId}/services/oauth2.googleapis.com:enable`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok && res.status !== 409) {
    // 409 = already enabled, ignore
    const errText = await res.text().catch(() => '');
    throw new Error(`enableOAuthApi failed: ${res.status} ${errText.slice(0, 200)}`);
  }
}

/**
 * Configure the OAuth consent screen (branding).
 */
async function configureConsentScreen(
  accessToken: string,
  projectId: string,
  config: { displayName: string; supportEmail: string; logoPath?: string },
): Promise<void> {
  // This uses the OAuth 2.0 Vendor API to set up the consent screen
  const url = `https://oauth2.googleapis.com/v2/oauth-clients/${projectId}/brand`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        applicationTitle: config.displayName,
        supportEmail: config.supportEmail,
        termsOfServiceUrl: `https://${projectId}.vercel.app/terms-of-service`,
        privacyPolicyUrl: `https://${projectId}.vercel.app/privacy-policy`,
      }),
    });

    if (!res.ok && res.status !== 404 && res.status !== 409) {
      const errText = await res.text().catch(() => '');
      console.warn(`[google-cloud] Consent screen config returned ${res.status}: ${errText.slice(0, 200)}`);
    }
  } catch (err) {
    // Non-fatal — consent screen can be configured manually
    console.warn('[google-cloud] Consent screen config failed (non-fatal):', err instanceof Error ? err.message : err);
  }
}

/**
 * Create an OAuth 2.0 Web client via the Google OAuth API.
 * Uses the OAuth2 Vendor API (documented in GCP Identity Platform docs).
 */
async function createOAuthClient(
  accessToken: string,
  projectId: string,
  config: { displayName: string; redirectUris: string[] },
): Promise<GcpOAuthClientResponse> {
  // The OAuth 2.0 Client API endpoint
  const url = `https://oauth2.googleapis.com/v2/oauth-clients?projectId=${projectId}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      displayName: config.displayName,
      type: 'WEB_APPLICATION',
      redirectUris: config.redirectUris,
      javascriptOrigins: config.redirectUris.map((u) => {
        try {
          const parsed = new URL(u);
          return `${parsed.protocol}//${parsed.host}`;
        } catch {
          return u;
        }
      }).filter((v, i, a) => a.indexOf(v) === i), // deduplicate
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    // If 409, the client might already exist
    if (res.status === 409) {
      console.warn('[google-cloud] OAuth client already exists (409) — attempting to read existing');
      const existing = await listOAuthClients(accessToken, projectId);
      if (existing) return existing;
    }
    throw new Error(`createOAuthClient failed: ${res.status} ${errText.slice(0, 300)}`);
  }

  const data = await res.json() as GcpOAuthClientResponse;
  return data;
}

/**
 * List OAuth clients for a project and return the first WEB_APPLICATION type.
 */
async function listOAuthClients(
  accessToken: string,
  projectId: string,
): Promise<GcpOAuthClientResponse | null> {
  const url = `https://oauth2.googleapis.com/v2/oauth-clients?projectId=${projectId}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return null;

  const data = await res.json() as { clients?: GcpOAuthClientResponse[] };
  return data.clients?.find((c) => c.redirect_uris?.length) ?? null;
}

/**
 * Build the client_secret JSON (same format as Google Cloud Console download).
 */
function buildClientSecretJson(
  client: GcpOAuthClientResponse,
  projectId: string,
): string {
  return JSON.stringify({
    web: {
      client_id: client.client_id,
      project_id: projectId,
      auth_uri: OAUTH_AUTH_URL,
      token_uri: OAUTH_TOKEN_URL,
      auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
      client_secret: client.client_secret,
      redirect_uris: client.redirect_uris ?? [],
      javascript_origins: client.redirect_uris?.map((u) => {
        try {
          return new URL(u).origin;
        } catch {
          return u;
        }
      }) ?? [],
    },
  }, null, 2);
}

/**
 * Upload a branding logo to the OAuth consent screen.
 * The logo must be a square PNG/JPG, max 1MB, 120x120px recommended.
 */
export async function uploadOAuthLogo(
  imageBase64: string,
  mimeType: string,
): Promise<boolean> {
  const auth = await getServiceAccountToken();
  if (!auth) {
    console.warn('[google-cloud] Cannot upload logo — no service account configured');
    return false;
  }

  const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || auth.projectId;
  const url = `https://oauth2.googleapis.com/v2/oauth-clients/${projectId}/brand/logo`;

  try {
    const res = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        'Content-Type': mimeType,
      },
      body: Buffer.from(imageBase64, 'base64'),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn(`[google-cloud] Logo upload failed: ${res.status} ${errText.slice(0, 200)}`);
      return false;
    }

    console.log('[google-cloud] Logo uploaded successfully to OAuth consent screen');
    return true;
  } catch (err) {
    console.warn('[google-cloud] Logo upload error:', err instanceof Error ? err.message : err);
    return false;
  }
}

// ── Strategy B: gcloud CLI ──────────────────────────────────

function tryStrategyGcloud(config: TenantGoogleConfig): GoogleOAuthClientResult | null {
  const { slug, displayName, redirectUris, adminEmail } = config;

  try {
    // Check if gcloud is available
    execSync('gcloud --version', { stdio: 'pipe', timeout: 5000 });
  } catch {
    return null; // gcloud not available
  }

  try {
    // Check if user is authenticated
    const account = execSync(
      'gcloud config list account --format="value(core.account)" 2>/dev/null',
      { stdio: 'pipe', timeout: 5000, encoding: 'utf8' },
    ).toString().trim();

    if (!account) {
      console.warn('[google-cloud] gcloud CLI found but not authenticated. Run: gcloud auth login');
      return null;
    }

    // Build a unique project ID
    const projectId = `tenant-${slug}`.replace(/[^a-z0-9-]/g, '-').slice(0, 30);
    console.log(`[google-cloud] gcloud strategy for "${slug}" using account: ${account}`);

    // Create project (try, fail gracefully if exists)
    try {
      execSync(
        `gcloud projects create ${projectId} --name="${displayName}" --labels=managed_by=tokenizmyapp,tenant=${projectId} --format=json`,
        { stdio: 'pipe', timeout: 30000 },
      );
      console.log(`[google-cloud] Created GCP project: ${projectId}`);
    } catch (projErr) {
      // Project may already exist or user may not have project creation permission
      console.warn('[google-cloud] Project creation (may already exist):',
        (projErr as { stderr?: Buffer }).stderr?.toString('utf8').slice(0, 200));
    }

    // Enable OAuth API
    try {
      execSync(
        `gcloud services enable oauth2.googleapis.com --project=${projectId}`,
        { stdio: 'pipe', timeout: 30000 },
      );
    } catch {
      console.warn(`[google-cloud] Could not enable OAuth API on ${projectId}`);
    }

    // Create the OAuth client
    const redirectArg = redirectUris.map((u) => `--redirect-uris="${u}"`).join(' ');
    const clientJson = execSync(
      `gcloud alpha identity oauth-client create "${displayName} (${slug})" ` +
      `--project=${projectId} ` +
      `--display-name="${displayName} (${slug})" ` +
      `--type=web ` +
      `${redirectArg} ` +
      `--support-email="${adminEmail}" ` +
      `--format=json 2>/dev/null`,
      { stdio: 'pipe', timeout: 30000, encoding: 'utf8' },
    ).toString();

    const parsed = JSON.parse(clientJson) as {
      clientId?: string;
      clientSecret?: string;
      name?: string;
    };

    if (!parsed.clientId || !parsed.clientSecret) {
      throw new Error('gcloud created OAuth client but response missing clientId/secret');
    }

    const clientSecretJson = buildClientSecretJson(
      { client_id: parsed.clientId, client_secret: parsed.clientSecret, display_name: displayName, redirect_uris: redirectUris },
      projectId,
    );

    return {
      clientId: parsed.clientId,
      clientSecret: parsed.clientSecret,
      projectId,
      projectName: displayName,
      redirectUris,
      clientEmail: adminEmail,
      authUri: OAUTH_AUTH_URL,
      tokenUri: OAUTH_TOKEN_URL,
      clientSecretJson,
      strategy: 'gcloud-cli',
    };
  } catch (err) {
    console.warn('[google-cloud] gcloud strategy failed:', (err as Error).message);
    return null;
  }
}

// ── Strategy C: Env fallback ─────────────────────────────────

function envVarFallback(config: TenantGoogleConfig): GoogleOAuthClientResult | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const projectId = process.env.GOOGLE_PROJECT_ID || 'shared-oauth-project';

  if (!clientId || !clientSecret) return null;

  const clientSecretJson = buildClientSecretJson(
    { client_id: clientId, client_secret: clientSecret, display_name: config.displayName, redirect_uris: config.redirectUris },
    projectId,
  );

  return {
    clientId,
    clientSecret,
    projectId,
    projectName: config.displayName,
    redirectUris: config.redirectUris,
    clientEmail: config.adminEmail,
    authUri: process.env.GOOGLE_AUTH_URI || OAUTH_AUTH_URL,
    tokenUri: process.env.GOOGLE_TOKEN_URI || OAUTH_TOKEN_URL,
    clientSecretJson,
    strategy: 'env-fallback',
  };
}

// ── Formatting ────────────────────────────────────────────────

/**
 * Pretty-print the OAuth credentials for terminal output.
 */
export function formatGoogleOAuthResult(result: GoogleOAuthClientResult): string {
  return `
╔══════════════════════════════════════════════════════════════╗
║          Google Cloud OAuth — Provisioned                     ║
╚══════════════════════════════════════════════════════════════╝

  Strategy:      ${result.strategy}
  Project ID:    ${result.projectId}
  Project Name:  ${result.projectName}
  Admin Email:   ${result.clientEmail || '(not set)'}
  Redirect URIs: ${result.redirectUris.join(', ')}

  ┌─ OAuth Credentials ──────────────────────────────────┐
  │  GOOGLE_CLIENT_ID=${result.clientId}
  │  GOOGLE_CLIENT_SECRET=${result.clientSecret}
  │  GOOGLE_PROJECT_ID=${result.projectId}
  │  GOOGLE_AUTH_URI=${result.authUri}
  │  GOOGLE_TOKEN_URI=${result.tokenUri}
  └────────────────────────────────────────────────────────┘

  Client Secret JSON saved to: Google/client_secret_${result.projectId}.json
`;
}

/**
 * Save the client_secret JSON to the Google/ directory.
 */
export async function saveClientSecretJson(result: GoogleOAuthClientResult): Promise<string> {
  // Use tmpdir on Vercel, local path in development
  const { tmpdir } = await import('node:os');
  const { writeFile, mkdir } = await import('node:fs/promises');
  const { existsSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');

  const isVercel = !!process.env.VERCEL;
  const baseDir = isVercel ? tmpdir() : process.cwd();
  const googleDir = join(baseDir, isVercel ? 'tenant-oauth' : 'Google');

  if (!existsSync(googleDir)) {
    await mkdir(googleDir, { recursive: true });
  }

  const filePath = join(googleDir, `client_secret_${result.projectId}.json`);
  await writeFile(filePath, result.clientSecretJson, 'utf8');
  console.log(`[google-cloud] Saved client_secret to ${filePath}`);
  return filePath;
}
