/**
 * Neon Provision Service — creates and manages per-tenant isolated Neon
 * Postgres branches.
 *
 * Each tenant gets its own branch off the project's main branch, a dedicated
 * database inside that branch, and a pair of connection strings (pooled for
 * app runtime, direct for migrations).
 *
 * Env vars:
 *   NEON_API_KEY    — Neon API key (https://console.neon.tech → Settings → API Keys)
 *   NEON_PROJECT_ID — Neon project ID (already in .env.local)
 *
 * Error handling:
 *   423 Locked      → project has conflicting ops, retry with backoff (2s, 4s, 8s, 16s)
 *   429 Rate Limit  → exponential backoff (1s, 2s, 4s, 8s)
 *   409 Conflict    → handled by check-first pattern (list before create)
 *   Never exposes the API key in error messages.
 */
const NEON_API = 'https://console.neon.tech/api/v2';

// ── Types ──────────────────────────────────────────────────────

export interface ProvisionedDatabase {
  pooledUrl: string;
  directUrl: string;
  branchId: string;
  databaseName: string;
}

interface NeonBranch {
  id: string;
  name: string;
  primary?: boolean;
  is_default?: boolean;
}

interface NeonEndpoint {
  host: string;
  hosts?: {
    read_write_host: string;
    read_write_pooled_host: string;
  };
  connection_string?: string;
  pooled_connection_string?: string;
}

// ── Config & helpers ───────────────────────────────────────────

function getConfig(): { apiKey: string; projectId: string } {
  const apiKey = process.env.NEON_API_KEY;
  const projectId = process.env.NEON_PROJECT_ID;
  if (!apiKey) {
    throw new Error(
      'NEON_API_KEY is not set. Get it from https://console.neon.tech → Settings → API Keys',
    );
  }
  if (!projectId) {
    throw new Error(
      'NEON_PROJECT_ID is not set. Find it in the Neon console project URL or dashboard.',
    );
  }
  return { apiKey, projectId };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Convert a tenant slug into a valid Postgres identifier (hyphens → underscores). */
function toPostgresIdentifier(slug: string): string {
  let name = slug.replace(/-/g, '_');
  // Postgres identifiers cannot start with a digit.
  if (/^[0-9]/.test(name)) name = `t_${name}`;
  return name;
}

/** Derive the pooled (PgBouncer) connection string from the direct string by
 *  inserting `-pooler` before the first `.neon.tech` host segment. */
function derivePooledUrl(directUrl: string): string {
  return directUrl.replace(/\.neon\.tech/, '-pooler.neon.tech');
}

/** Strip any credentials from a connection string for safe logging. */
function redactUrl(url: string): string {
  return url.replace(/:\/\/[^@]+@/, '://***:***@');
}

// ── Neon API client with retry/backoff ─────────────────────────

async function neonFetch(
  path: string,
  options: RequestInit = {},
  maxRetries = 4,
): Promise<Response> {
  const { apiKey } = getConfig();
  const url = `${NEON_API}${path}`;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    // 423 = project locked by conflicting operations — wait and retry
    if (res.status === 423) {
      if (attempt === maxRetries) {
        console.warn(`[neon-provision] Project locked after ${maxRetries + 1} attempts: ${path}`);
        return res;
      }
      const delay = Math.min(2 ** attempt * 2000, 16000); // 2s, 4s, 8s, 16s
      console.warn(
        `[neon-provision] Project locked (423), retrying in ${delay}ms ` +
        `(attempt ${attempt + 1}/${maxRetries + 1})`,
      );
      await sleep(delay);
      continue;
    }

    if (res.status !== 429) return res;

    if (attempt === maxRetries) {
      console.warn(`[neon-provision] Rate limited after ${maxRetries + 1} attempts: ${path}`);
      return res;
    }

    const delay = Math.min(2 ** attempt * 1000, 8000); // 1s, 2s, 4s, 8s
    console.warn(
      `[neon-provision] Rate limited (429), retrying in ${delay}ms ` +
      `(attempt ${attempt + 1}/${maxRetries + 1})`,
    );
    await sleep(delay);
  }

  // Unreachable, but satisfies the type checker.
  throw new Error(`[neon-provision] Exhausted retries for ${path}`);
}

// ── Branch helpers ─────────────────────────────────────────────

async function listBranches(): Promise<NeonBranch[]> {
  const { projectId } = getConfig();
  const res = await neonFetch(`/projects/${projectId}/branches`);
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Failed to list Neon branches: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { branches?: NeonBranch[] };
  return data.branches ?? [];
}

async function findBranchIdByName(name: string): Promise<string> {
  const branches = await listBranches();
  const found = branches.find((b) => b.name === name);
  if (!found) {
    throw new Error(`Neon branch "${name}" not found in project`);
  }
  return found.id;
}

interface NeonDatabase {
  name: string;
}

/** List all databases in a branch. */
async function listDatabases(branchId: string): Promise<NeonDatabase[]> {
  const { projectId } = getConfig();
  const res = await neonFetch(`/projects/${projectId}/branches/${branchId}/databases`);
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Failed to list databases in branch ${branchId}: ${res.status} ${err.slice(0, 200)}`);
  }
  const data = await res.json() as { databases?: NeonDatabase[] };
  return data.databases ?? [];
}

/** Check if a database exists by name in a branch. */
async function databaseExists(branchId: string, dbName: string): Promise<boolean> {
  const databases = await listDatabases(branchId);
  return databases.some((d) => d.name === dbName);
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Get the ID of the project's main (primary) branch.
 * Tries `primary`, then `is_default`, then a branch named `main`.
 */
export async function getMainBranchId(): Promise<string> {
  const branches = await listBranches();
  const main =
    branches.find((b) => b.primary) ??
    branches.find((b) => b.is_default) ??
    branches.find((b) => b.name === 'main');
  if (!main) {
    throw new Error(
      'No main/primary branch found in Neon project. ' +
      'Ensure the project has a primary branch before provisioning tenants.',
    );
  }
  return main.id;
}

/**
 * Provision an isolated database branch for a tenant.
 *
 * 1. Creates a branch `tenant-{slug}` off the main branch.
 * 2. Creates a database inside the branch (hyphens → underscores).
 * 3. Retrieves pooled + direct connection strings.
 *
 * If the branch already exists (409), it is reused.
 *
 * Returns connection strings and identifiers. Never logs credentials —
 * use the returned `pooledUrl`/`directUrl` to inject into the tenant's env.
 */
export async function provisionTenantDatabase(
  slug: string,
): Promise<ProvisionedDatabase> {
  const { projectId } = getConfig();
  const branchName = `tenant-${slug}`;
  const databaseName = toPostgresIdentifier(slug);

  // 1. Resolve the main branch to branch off from.
  const mainBranchId = await getMainBranchId();
  console.log(`[neon-provision] Branching "${branchName}" off main branch ${mainBranchId}`);

  // 2. Check if branch already exists; if not, create it.
  let branchId: string;
  try {
    branchId = await findBranchIdByName(branchName);
    console.log(`[neon-provision] Branch "${branchName}" already exists — reusing (${branchId})`);
  } catch {
    // Branch not found — create it with read_write endpoint
    console.log(`[neon-provision] Creating branch "${branchName}" with read_write endpoint...`);
    const createRes = await neonFetch(`/projects/${projectId}/branches`, {
      method: 'POST',
      body: JSON.stringify({
        branch: { name: branchName, parent_id: mainBranchId },
        endpoints: [{ type: 'read_write' }],
      }),
    });

    if (createRes.status === 409) {
      console.log(`[neon-provision] Branch "${branchName}" already exists (409) — reusing`);
      branchId = await findBranchIdByName(branchName);
    } else if (!createRes.ok) {
      const err = await createRes.text().catch(() => '');
      throw new Error(
        `Failed to create Neon branch "${branchName}": ${createRes.status} ${err.slice(0, 200)}`,
      );
    } else {
      const data = await createRes.json() as { branch?: { id: string } };
      branchId = data.branch?.id ?? '';
      if (!branchId) {
        throw new Error(`Neon create branch returned no branch id for "${branchName}"`);
      }
      console.log(`[neon-provision] Branch created: ${branchId} (${branchName})`);
    }
  }

  // 3. Check if database already exists; if not, create it.
  const dbExists = await databaseExists(branchId, databaseName);
  if (dbExists) {
    console.log(`[neon-provision] Database "${databaseName}" already exists in branch ${branchId} — reusing`);
  } else {
    console.log(`[neon-provision] Creating database "${databaseName}" in branch ${branchId}...`);
    const dbRes = await neonFetch(
      `/projects/${projectId}/branches/${branchId}/databases`,
      {
        method: 'POST',
        body: JSON.stringify({ database: { name: databaseName, owner_name: 'neondb_owner' } }),
      },
    );
    if (!dbRes.ok && dbRes.status !== 409) {
      const err = await dbRes.text().catch(() => '');
      throw new Error(
        `Failed to create database "${databaseName}" in branch ${branchId}: ` +
        `${dbRes.status} ${err.slice(0, 200)}`,
      );
    }
    console.log(`[neon-provision] Database "${databaseName}" ready in branch ${branchId}`);
  }

  // 4. Retrieve connection strings (branch endpoint may take a moment to be ready).
  const { pooledUrl, directUrl } = await getConnectionStrings(branchId);

  console.log(
    `[neon-provision] Provisioned ${branchName}: branch=${branchId}, ` +
    `db=${databaseName}, pooled=${redactUrl(pooledUrl)}`,
  );

  return { pooledUrl, directUrl, branchId, databaseName };
}

/**
 * Deprovision (delete) a tenant's branch and all its databases.
 * Idempotent — returns `{ deleted: false }` if the branch does not exist.
 */
export async function deprovisionTenantDatabase(
  slug: string,
): Promise<{ deleted: boolean; branchId: string | null }> {
  const { projectId } = getConfig();
  const branchName = `tenant-${slug}`;

  let branchId: string;
  try {
    branchId = await findBranchIdByName(branchName);
  } catch {
    console.log(`[neon-provision] Branch "${branchName}" not found — nothing to deprovision`);
    return { deleted: false, branchId: null };
  }

  const res = await neonFetch(
    `/projects/${projectId}/branches/${branchId}`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404) {
    const err = await res.text().catch(() => '');
    throw new Error(
      `Failed to delete Neon branch "${branchName}" (${branchId}): ` +
      `${res.status} ${err.slice(0, 200)}`,
    );
  }

  console.log(`[neon-provision] Branch deleted: ${branchId} (${branchName})`);
  return { deleted: true, branchId };
}

// ── Endpoint / connection string retrieval ─────────────────────

/**
 * Fetch the branch's endpoints and extract connection strings.
 * Polls briefly since a freshly created branch's endpoint may not be
 * immediately ready.
 */
async function getConnectionStrings(
  branchId: string,
): Promise<{ pooledUrl: string; directUrl: string }> {
  const { projectId } = getConfig();
  const maxAttempts = 5;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await neonFetch(
      `/projects/${projectId}/branches/${branchId}/endpoints`,
    );

    if (res.ok) {
      const data = await res.json() as { endpoints?: NeonEndpoint[] };
      const ep = data.endpoints?.[0];
      if (!ep) continue;

      // Try direct connection_string first (some API versions include it)
      let directUrl = ep.connection_string ?? '';
      let pooledUrl = ep.pooled_connection_string ?? '';

      // If connection_string not provided, construct from host + env credentials
      if (!directUrl && ep.host) {
        const pgUser = process.env.POSTGRES_USER || process.env.PGUSER || 'neondb_owner';
        const pgPass = process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '';
        const pgDb = process.env.POSTGRES_DATABASE || process.env.PGDATABASE || 'neondb';
        const directHost = ep.hosts?.read_write_host ?? ep.host;
        const pooledHost = ep.hosts?.read_write_pooled_host ?? derivePooledHost(directHost);

        directUrl = `postgresql://${pgUser}:${pgPass}@${directHost}/${pgDb}?sslmode=require`;
        pooledUrl = `postgresql://${pgUser}:${pgPass}@${pooledHost}/${pgDb}?sslmode=require`;
      }

      // Fallback: derive pooled from direct
      if (!pooledUrl && directUrl) {
        pooledUrl = derivePooledUrl(directUrl);
      }

      if (pooledUrl && directUrl) {
        return { pooledUrl, directUrl };
      }
    }

    if (attempt < maxAttempts - 1) {
      console.log(
        `[neon-provision] Endpoints not ready for branch ${branchId}, ` +
        `retrying (${attempt + 1}/${maxAttempts})...`,
      );
      await sleep(2000);
    }
  }

  throw new Error(
    `Could not retrieve connection strings for branch ${branchId} ` +
    `after ${maxAttempts} attempts. Check the Neon console for branch status.`,
  );
}

/**
 * Derive the pooled host from a direct host by inserting '-pooler' before the region.
 * e.g., ep-xxx.c-12.us-east-1.aws.neon.tech → ep-xxx-pooler.c-12.us-east-1.aws.neon.tech
 */
function derivePooledHost(directHost: string): string {
  return directHost.replace(/\.c-/, '-pooler.c-');
}
