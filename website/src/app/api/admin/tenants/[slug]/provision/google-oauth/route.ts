/**
 * Google OAuth Provisioning — POST /api/admin/tenants/[slug]/provision/google-oauth
 *
 * Standalone endpoint to provision Google OAuth credentials for a tenant.
 * Creates a new OAuth 2.0 Web client via gcloud CLI or Google Cloud REST API.
 *
 * Body:
 *   { email?: string, redirectUris?: string[], logoPath?: string }
 *
 * Response:
 *   { success, clientId, clientSecret, projectId, clientSecretJson, strategy }
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { createClient } from '@/lib/db';
import { provisionGoogleOAuth, saveClientSecretJson } from '@/domain/tenant/google-cloud-service';
import { setGoogleOAuthConfig } from '@/lib/auth/google-oauth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  email: z.string().email().optional(),
  redirectUris: z.array(z.string().url()).optional(),
  logoPath: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const { slug } = await params;

  let body: unknown;
  try { body = await request.json(); } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(`Validation failed: ${parsed.error.issues.map((i) => i.message).join(', ')}`, 400);
  }

  try {
    // Get tenant info for display name
    const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    const tenant = await db.tenant.findUnique({ where: { slug }, select: { displayName: true, metadata: true } });

    const oauthResult = await provisionGoogleOAuth({
      slug,
      displayName: tenant?.displayName || slug,
      redirectUris: parsed.data.redirectUris || [
        `https://${slug}.vercel.app`,
        `https://${slug}.vercel.app/api/auth?action=google-callback`,
      ],
      adminEmail: parsed.data.email || guard.session.email || 'admin@tokenizmyapp.com',
      logoPath: parsed.data.logoPath,
    });

    // Persist to DB (encrypted)
    await setGoogleOAuthConfig({
      clientId: oauthResult.clientId,
      clientSecret: oauthResult.clientSecret,
      projectId: oauthResult.projectId,
      authUri: oauthResult.authUri,
      tokenUri: oauthResult.tokenUri,
    });

    // Save JSON file
    const savedPath = await saveClientSecretJson(oauthResult);

    return jsonOk({
      success: true,
      slug,
      clientId: oauthResult.clientId,
      clientSecret: oauthResult.clientSecret,
      projectId: oauthResult.projectId,
      projectName: oauthResult.projectName,
      strategy: oauthResult.strategy,
      clientSecretJsonPath: savedPath,
      redirectUris: oauthResult.redirectUris,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[provision:google-oauth] Failed for ${slug}:`, message);
    return jsonError(`Google OAuth provisioning failed: ${message}`, 500);
  }
}
