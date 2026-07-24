/**
 * Auth API — JWT session cookie (redruby.session).
 * Legacy reference: website/api/auth.js (read-only)
 */
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleStoreKey } from '@/lib/auth/store-key';
import { handleStoreGoogleOAuth } from '@/lib/auth/store-google-oauth';
import {
  buildGoogleAuthUrl,
  getGoogleOAuthCredentials,
  getGoogleOAuthPublicConfig,
} from '@/lib/auth/google-oauth';
import { sessionIsPlatformAdmin, signSession } from '@/lib/auth/jwt';
import { resolveRoleForEmail } from '@/domain/seed/seed-runner';
import { PERSONS, resolvePerson } from '@/domain/security/persons';
import {
  clearSessionCookie,
  getOrigin,
  getSessionFromRequest,
  setSessionCookie,
} from '@/lib/auth/session';
import { requireGoogle } from '@/lib/auth/guards';
import { getSecretPlaintext } from '@/lib/secrets';
import { createClient, createBaseClient } from '@/lib/db';
import { PdfExportService } from '@/domain/pdf/pdf-export-service';
import { ensureJobQueueTable, ensureSecurityTables } from '@/lib/db-migrate';
import { resolveGroupCodesForSub, resolveCapabilitiesForSub, upsertUserAccount } from '@/domain/security/security-service';
import { legacyError, jsonError } from '@/lib/api/response';

export const maxDuration = 60;

let jobQueueEnsured: Promise<boolean> | null = null;
function ensureJobQueueOnce(): Promise<boolean> {
  if (!jobQueueEnsured) {
    jobQueueEnsured = ensureJobQueueTable(createClient()).catch((err) => {
      jobQueueEnsured = null;
      throw err;
    });
  }
  return jobQueueEnsured;
}

const verifyPinSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.string().min(1).optional(),
  pin: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';

  switch (action) {
    case 'google-config':
      return handleGoogleConfig();
    case 'google':
      return handleGoogleRedirect(request, url);
    case 'google-callback':
      return handleGoogleCallback(request, url);
    case 'me':
      return handleMe(request);
    case 'logout':
      return handleLogout(request);
    case 'list-pin-users':
      return handleListPinUsers();
    case 'pdf':
      return handlePdf(request, url);
    default:
      return jsonError('Unknown action — use google|google-callback|google-config|me|logout|pdf|verify-pin|store-key|store-google-oauth|list-pin-users', 400);
  }
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const action = url.searchParams.get('action') ?? '';

  if (action === 'store-key') {
    const result = await handleStoreKey(request);
    const status = result.success ? 200 : result.error?.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json(result, { status });
  }

  if (action === 'store-google-oauth') {
    const result = await handleStoreGoogleOAuth(request);
    const status = result.success ? 200 : result.error?.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json(result, { status });
  }

  if (action === 'verify-pin') {
    return handleVerifyPin(request);
  }

  return jsonError('Unknown action', 400);
}

async function handleGoogleConfig(): Promise<NextResponse> {
  const config = await getGoogleOAuthPublicConfig();
  if (!config) {
    return jsonError('Google OAuth not configured', 503);
  }
  return NextResponse.json({
    success: true,
    data: {
      clientId: config.clientId,
      projectId: config.projectId,
      authUri: config.authUri,
    },
  });
}

async function handleGoogleRedirect(request: Request, url: URL): Promise<NextResponse> {
  const config = await getGoogleOAuthCredentials();
  if (!config) {
    console.error('[auth] Google OAuth not configured');
    return NextResponse.redirect(new URL('/ops-admin?auth=error', getOrigin(request)));
  }

  const redirectTo = url.searchParams.get('redirect') || '/';
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const state = `${redirectTo}::${nonce}`;
  const origin = getOrigin(request);
  const redirectUri = `${origin}/api/auth/callback/google`;

  const authUrl = buildGoogleAuthUrl(config, { redirectUri, state });
  return NextResponse.redirect(authUrl);
}

async function handleGoogleCallback(request: Request, url: URL): Promise<NextResponse> {
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state') ?? '';
  const oauthError = url.searchParams.get('error');

  let redirectTo = '/';
  if (state.includes('::')) {
    redirectTo = state.split('::')[0] || '/';
  }

  const origin = getOrigin(request);

  if (oauthError || !code) {
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }

  const config = await getGoogleOAuthCredentials();
  if (!config) {
    console.error('[auth/google-callback] OAuth not configured');
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }

  try {
    const tokenResp = await fetch(config.tokenUri, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: config.clientId,
        client_secret: config.clientSecret,
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResp.ok) {
      console.error('[auth/google-callback] Token exchange failed:', tokenResp.status);
      return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
    }

    const tokens = await tokenResp.json() as { access_token?: string };
    const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userResp.ok) {
      console.error('[auth/google-callback] Userinfo failed:', userResp.status);
      return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
    }

    const user = await userResp.json() as {
      id: string;
      email?: string;
      name?: string;
      picture?: string;
    };

    const matchedRole = resolveRoleForEmail(user.email);
    const { groups, permissions } = await resolveSessionGroups({
      sub: user.id,
      email: user.email,
      name: user.name,
      tier: 'google',
      roleCode: matchedRole?.code,
    });
    const platformAdmin =
      (matchedRole?.isPlatformAdmin ?? false) || groups.includes('platform-admin');
    const token = await signSession({
      sub: user.id,
      tier: 'google',
      email: user.email,
      name: user.name,
      picture: user.picture,
      roleCode: matchedRole?.code,
      platformAdmin,
      groups,
      permissions,
    });

    const response = NextResponse.redirect(new URL(`${redirectTo}?auth=success`, origin));
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('[auth/google-callback] Error:', err instanceof Error ? err.message : err);
    return NextResponse.redirect(new URL(`${redirectTo}?auth=error`, origin));
  }
}

/**
 * Persist the signed-in identity as a UserAccount (idempotent) and resolve the
 * security-group codes to embed in the session token. Best-effort: failures here
 * must not block sign-in, so errors are swallowed and groups default to [].
 */
async function resolveSessionGroups(input: {
  sub: string;
  email?: string | null;
  name?: string | null;
  tier: string;
  roleCode?: string | null;
}): Promise<{ groups: string[]; permissions: string[] }> {
  try {
    // Raw client: account persistence must not be blocked by ZenStack policies.
    // Don't pass knownAccounts here — that would re-create deleted users.
    // The current user's account is created via upsertUserAccount below.
    const db = createBaseClient();
    await ensureSecurityTables(db);
    await upsertUserAccount(db, input);
    const groups = await resolveGroupCodesForSub(db, input.sub);
    const permissions = await resolveCapabilitiesForSub(db, input.sub);
    return { groups, permissions };
  } catch (err) {
    // Sign-in must still succeed even if group resolution fails, but we log so
    // the failure is diagnosable instead of silently dropping accounts.
    console.error('[auth/resolveSessionGroups]', err instanceof Error ? err.message : err);
    return { groups: [], permissions: [] };
  }
}

async function handleMe(request: Request): Promise<NextResponse> {
  try {
    const session = await getSessionFromRequest(request);
    return NextResponse.json({
      success: true,
      data: {
        user: session
          ? {
              id: session.sub,
              email: session.email,
              name: session.name,
              picture: session.picture,
              authMethod: session.tier,
            }
          : null,
        tier: session?.tier ?? 'public',
        roleCode: session?.roleCode ?? null,
        platformAdmin: sessionIsPlatformAdmin(session),
        groups: session?.groups ?? [],
        permissions: session?.permissions ?? [],
      },
    });
  } catch {
    return NextResponse.json({ success: true, data: { user: null, tier: 'public' } });
  }
}

function handleLogout(request: Request): NextResponse {
  const origin = getOrigin(request);
  const response = NextResponse.redirect(new URL('/dashboard', origin));
  clearSessionCookie(response);
  return response;
}

async function handleVerifyPin(request: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = verifyPinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'name (or role) and pin are required' }, { status: 400 });
  }

  const { name, role, pin } = parsed.data;

  try {
    // Resolve the person identity by name (e.g. "Ama") or fall back to role (sub).
    let sub: string;
    let person: ReturnType<typeof resolvePerson>;
    if (name) {
      person = PERSONS.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (!person) {
        return NextResponse.json({ ok: false, error: 'Unknown user' }, { status: 400 });
      }
      sub = person.sub;
    } else if (role) {
      sub = role.toLowerCase();
      person = resolvePerson(sub);
    } else {
      return NextResponse.json({ ok: false, error: 'name or role is required' }, { status: 400 });
    }

    const isPlatformAdmin = person?.isPlatformAdmin ?? sub === 'admin';

    // PIN key: USER_PIN_<sub> for individuals, ADMIN_PIN for platform admin.
    const secretKey = isPlatformAdmin ? 'ADMIN_PIN' : `USER_PIN_${sub}`;
    const stored = await getSecretPlaintext(secretKey);
    if (!stored) {
      return NextResponse.json({ ok: false, error: 'PIN not configured for this user' });
    }
    if (pin.trim() !== stored.trim()) {
      return NextResponse.json({ ok: false, error: 'Incorrect PIN' });
    }

    const roleCode = person?.roleCode ?? null;
    const { groups, permissions } = await resolveSessionGroups({
      sub,
      name: person?.name ?? sub,
      tier: 'pin',
      roleCode,
    });
    const platformAdmin = isPlatformAdmin || groups.includes('platform-admin');
    const token = await signSession({
      sub,
      name: person?.name ?? sub,
      tier: 'pin',
      roleCode,
      platformAdmin,
      groups,
      permissions,
    });
    const response = NextResponse.json({ ok: true, success: true });
    setSessionCookie(response, token);
    return response;
  } catch (err) {
    console.error('[auth/verify-pin]', err);
    return NextResponse.json({ ok: false, error: 'Server error' }, { status: 500 });
  }
}

/**
 * Public endpoint that returns the list of persons who have a PIN configured,
 * so the sign-in dropdown only shows users who can actually authenticate.
 */
async function handleListPinUsers(): Promise<NextResponse> {
  const results = await Promise.all(
    PERSONS.map(async (p) => {
      const key = p.isPlatformAdmin ? 'ADMIN_PIN' : `USER_PIN_${p.sub}`;
      const hasPin = (await getSecretPlaintext(key)) != null;
      return { name: p.name, sub: p.sub, hasPin };
    }),
  );
  return NextResponse.json({ success: true, data: { users: results } });
}

async function handlePdf(request: Request, url: URL): Promise<NextResponse> {
  const guard = await requireGoogle(request);
  if (!guard.ok) return guard.response;

  try {
    const origin = getOrigin(request);
    const sessionCookie = request.headers.get('cookie') ?? '';
    const pagePath = url.searchParams.get('page') || '/';

    const db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
    const pdfService = new PdfExportService(db);
    try {
      await ensureJobQueueOnce();
    } catch {
      // Table ensure is best-effort; queueJob surfaces the real error if the table is missing.
    }
    const jobId = await pdfService.queueJob(guard.session.sub, {
      origin,
      sessionCookie,
      pagePath,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          message: 'PDF generation job submitted successfully.',
          jobId,
          statusCheckUrl: `${origin}/api/vjobs/status/${jobId}`,
        },
      },
      { status: 202, headers: { 'Retry-After': '60' } },
    );
  } catch (err) {
    console.error('[auth/pdf]', err);
    return legacyError('Internal Server Error while queuing the PDF job.', 500);
  }
}
