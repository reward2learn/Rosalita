/**
 * Store Google OAuth credentials via SETUP_TOKEN bearer (setup-only).
 * client_secret is encrypted before persisting — never stored in plaintext.
 */
import { z } from 'zod';
import { setGoogleOAuthConfig } from '@/lib/auth/google-oauth';

const googleWebSchema = z.object({
  client_id: z.string().min(1),
  project_id: z.string().min(1),
  auth_uri: z.string().url(),
  token_uri: z.string().url().optional(),
  client_secret: z.string().min(1),
});

const storeGoogleOAuthBodySchema = z.union([
  z.object({
    clientId: z.string().min(1),
    projectId: z.string().min(1),
    authUri: z.string().url(),
    tokenUri: z.string().url().optional(),
    clientSecret: z.string().min(1),
  }),
  z.object({
    web: googleWebSchema,
  }),
]);

export interface StoreGoogleOAuthResult {
  success: boolean;
  clientId?: string;
  projectId?: string;
  error?: string;
}

export async function handleStoreGoogleOAuth(request: Request): Promise<StoreGoogleOAuthResult> {
  const auth = request.headers.get('authorization') ?? '';
  const token = process.env.SETUP_TOKEN;
  if (!token || auth !== `Bearer ${token}`) {
    return { success: false, error: 'Unauthorized — SETUP_TOKEN bearer required' };
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { success: false, error: 'Invalid JSON body' };
  }

  const parsed = storeGoogleOAuthBodySchema.safeParse(body);
  if (!parsed.success) {
    return {
      success: false,
      error: 'Body must include clientId, projectId, authUri, clientSecret (or web credentials JSON)',
    };
  }

  const input = 'web' in parsed.data
    ? {
        clientId: parsed.data.web.client_id,
        projectId: parsed.data.web.project_id,
        authUri: parsed.data.web.auth_uri,
        tokenUri: parsed.data.web.token_uri,
        clientSecret: parsed.data.web.client_secret,
      }
    : parsed.data;

  try {
    await setGoogleOAuthConfig(input);
    return { success: true, clientId: input.clientId, projectId: input.projectId };
  } catch (err) {
    console.error('[store-google-oauth]', err);
    return { success: false, error: 'Failed to store Google OAuth config' };
  }
}
