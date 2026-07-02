import {
  ensureGoogleOAuthTable,
  setGoogleOAuthConfig,
} from '../../src/lib/auth/google-oauth';

/** Test Google OAuth credentials for E2E — secret is fake; OAuth flow is not exercised. */
export const E2E_GOOGLE_OAUTH = {
  clientId: 'e2e-test-client-id.apps.googleusercontent.com',
  projectId: 'e2e-test-project',
  authUri: 'https://accounts.google.com/o/oauth2/auth',
  tokenUri: 'https://oauth2.googleapis.com/token',
  clientSecret: 'e2e-test-client-secret',
} as const;

export async function seedGoogleOAuthForE2E(): Promise<void> {
  if (!process.env.POSTGRES_URL || !process.env.ENCRYPTION_KEY) return;

  await ensureGoogleOAuthTable();
  await setGoogleOAuthConfig(E2E_GOOGLE_OAUTH);
}

export async function verifyGoogleOAuthConfig(): Promise<boolean> {
  if (!process.env.POSTGRES_URL) return false;

  try {
    const { getGoogleOAuthPublicConfig } = await import('../../src/lib/auth/google-oauth');
    const config = await getGoogleOAuthPublicConfig();
    return config !== null;
  } catch {
    return false;
  }
}
