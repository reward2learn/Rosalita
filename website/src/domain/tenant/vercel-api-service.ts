/**
 * Vercel REST API Deployment Service
 *
 * Triggers production deployments via Vercel's REST API (not CLI exec).
 * Works in serverless environments where child_process is unreliable.
 *
 * Requires VERCEL_TOKEN env var (Vercel Access Token with deploy scope).
 * Falls back gracefully if token is not available.
 *
 * For git-connected projects: uses gitSource to deploy from branch.
 * For CLI-deployed projects: uses forceNew to rebuild latest source.
 */

interface VercelDeployResult {
  success: boolean;
  deploymentId?: string;
  appUrl?: string;
  error?: string;
}

interface VercelDeploymentResponse {
  id: string;
  url: string;
  name: string;
  target: string;
  state: string;
  readyState?: string;
  [key: string]: unknown;
}

const VERCEL_API_BASE = 'https://api.vercel.com';
const TEAM_ID = 'team_uKNaNEyjHVW7vooXeUfNJ3LW';

/**
 * Read the Vercel API token from environment.
 * Checks VERCEL_TOKEN first, then falls back to alternatives.
 */
function getVercelToken(): string | undefined {
  return process.env.VERCEL_TOKEN || process.env.VERCEL_API_TOKEN || undefined;
}

/**
 * Trigger a production deployment for a Vercel project.
 *
 * Strategy:
 * 1. For git-connected projects: deploy from main branch
 * 2. For CLI-deployed projects: forceNew rebuilds latest uploaded source
 *
 * @param projectId - Vercel project ID (e.g. prj_kHPW3f3yGArIihBH3J1zJk4wSmhp)
 * @param projectName - Project name (e.g. redrubybali)
 * @returns Deployment result with URL and ID
 */
export async function triggerVercelDeploy(
  projectId: string,
  projectName: string,
): Promise<VercelDeployResult> {
  const token = getVercelToken();

  if (!token) {
    console.warn('[vercel-api] VERCEL_TOKEN not set. Cannot trigger deployment via API.');
    console.warn('[vercel-api] Set VERCEL_TOKEN in project env vars (Vercel dashboard → Settings → Environment Variables).');
    return {
      success: false,
      error: 'VERCEL_TOKEN not configured. Add a Vercel Access Token to the project environment variables.',
    };
  }

  const url = `${VERCEL_API_BASE}/v13/deployments?teamId=${TEAM_ID}`;

  const body: Record<string, unknown> = {
    name: projectName,
    project: projectId,
    target: 'production',
    forceNew: true,
  };

  console.log(`[vercel-api] Triggering deployment for ${projectName} (${projectId})...`);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json() as VercelDeploymentResponse | { error: { message: string } };

    if (!response.ok) {
      const errorMsg = (data as { error: { message: string } }).error?.message ||
        `Vercel API returned ${response.status}`;
      console.error(`[vercel-api] Deployment failed: ${errorMsg}`);
      return { success: false, error: errorMsg };
    }

    const deployment = data as VercelDeploymentResponse;
    const appUrl = `https://${deployment.url}`;

    console.log(`[vercel-api] Deployment triggered: ${deployment.id} → ${appUrl}`);
    console.log(`[vercel-api] State: ${deployment.readyState || deployment.state}`);

    return {
      success: true,
      deploymentId: deployment.id,
      appUrl,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[vercel-api] API call failed: ${message}`);
    return { success: false, error: message };
  }
}

/**
 * Check if a Vercel token is available.
 */
export function hasVercelToken(): boolean {
  return !!getVercelToken();
}

/**
 * Get the Vercel project dashboard URL.
 */
export function getVercelDashboardUrl(projectName: string): string {
  return `https://vercel.com/ilishaps-projects/${projectName}`;
}
