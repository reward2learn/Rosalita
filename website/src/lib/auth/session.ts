import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  verifySession,
  type AuthTier,
  type SessionClaims,
} from '@/lib/auth/jwt';

function isProduction(): boolean {
  return process.env.VERCEL_ENV === 'production';
}

export function buildSessionCookie(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProduction() ? 'Secure' : '',
    `Max-Age=${SESSION_MAX_AGE}`,
  ].filter(Boolean).join('; ');
}

export function buildClearSessionCookie(): string {
  return [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProduction() ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; ');
}

export function setSessionCookie(response: NextResponse, token: string): void {
  response.headers.append('Set-Cookie', buildSessionCookie(token));
}

export function clearSessionCookie(response: NextResponse): void {
  response.headers.append('Set-Cookie', buildClearSessionCookie());
}

function parseCookieHeader(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split(';').map((part) => {
      const [k, ...v] = part.trim().split('=');
      return [k, v.join('=')];
    }).filter(([k]) => k),
  );
}

export async function getSessionFromRequest(request: Request): Promise<SessionClaims | null> {
  // Fast path: headers injected by middleware (already validated)
  if (request.headers.get('X-Session-Verified') === '1') {
    return {
      sub: request.headers.get('X-Session-Sub')!,
      tier: request.headers.get('X-Session-Tier') as AuthTier,
      email: request.headers.get('X-Session-Email') ?? undefined,
      name: request.headers.get('X-Session-Name') ?? undefined,
      roleCode: request.headers.get('X-Session-RoleCode') ?? undefined,
      platformAdmin: request.headers.get('X-Session-PlatformAdmin') === '1',
      groups: JSON.parse(request.headers.get('X-Session-Groups') ?? '[]'),
      permissions: JSON.parse(request.headers.get('X-Session-Permissions') ?? '[]'),
    };
  }

  // Slow path: parse cookie and verify JWT (original behavior)
  const raw = request.headers.get('cookie') ?? '';
  const token = parseCookieHeader(raw)[COOKIE_NAME];
  if (!token) return null;
  return verifySession(token);
}

/** Server component / route helper using next/headers cookies(). */
export async function getSession(): Promise<SessionClaims | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

const PRODUCTION_APP_URL = 'https://redrubybali.vercel.app';

/** Detect whether we are running in a local development environment. */
function isLocalDev(): boolean {
  // Vercel sets VERCEL_ENV on both deployments and `vercel dev`.
  // When it's unset we're running a plain Next.js dev server (bun run dev, npm run dev).
  return !process.env.VERCEL_ENV;
}

function resolveCanonicalAppUrl(): string {
  // In local dev without Vercel, default to localhost:3000
  if (isLocalDev()) return 'http://localhost:3000';

  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromPublic) return fromPublic;
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_APP_URL;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return PRODUCTION_APP_URL;
}

export function getOrigin(request: Request): string {
  // Determine the origin from the request's Host header.
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  if (host) {
    const origin = `${proto}://${host.split(',')[0].trim()}`;
    // On production Vercel domains, use the canonical URL for consistency
    if (origin.includes('redrubybali.vercel.app') || origin.includes(process.env.VERCEL_URL ?? '')) {
      return resolveCanonicalAppUrl();
    }
    return origin;
  }
  // Fallback when no request host is available
  return resolveCanonicalAppUrl();
}
