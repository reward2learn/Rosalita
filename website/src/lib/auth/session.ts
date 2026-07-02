import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  COOKIE_NAME,
  SESSION_MAX_AGE,
  verifySession,
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

const PRODUCTION_APP_URL = 'https://rosalita-business-review.vercel.app';

function resolveCanonicalAppUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromPublic) return fromPublic;
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_APP_URL;
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) return `https://${vercelUrl}`;
  return PRODUCTION_APP_URL;
}

export function getOrigin(request: Request): string {
  if (process.env.VERCEL_ENV === 'production') {
    return resolveCanonicalAppUrl();
  }

  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  const proto = request.headers.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  if (host) return `${proto}://${host.split(',')[0].trim()}`;
  return resolveCanonicalAppUrl();
}
