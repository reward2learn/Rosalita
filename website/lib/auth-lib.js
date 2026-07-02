/**
 * Shared auth helpers — JWT session management for both api/auth.js
 * and api/auth/callback/google.js
 */
import { SignJWT, jwtVerify } from 'jose';

export const COOKIE_NAME = 'rosalita.session';
const MAX_AGE = 30 * 24 * 60 * 60; // 30 days

function getJwtSecret() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  return new TextEncoder().encode(key.slice(0, 32));
}

export async function createSession(payload) {
  return await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(getJwtSecret());
}

export function setCookie(res, token) {
  const isProd = process.env.VERCEL_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    `Max-Age=${MAX_AGE}`,
  ].filter(Boolean).join('; '));
}

export function clearCookie(res) {
  const isProd = process.env.VERCEL_ENV === 'production';
  res.setHeader('Set-Cookie', [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    isProd ? 'Secure' : '',
    'Max-Age=0',
  ].filter(Boolean).join('; '));
}

export async function getSession(req) {
  const raw = req.headers.cookie || '';
  const cookies = Object.fromEntries(raw.split(';').map(c => {
    const [k, ...v] = c.trim().split('=');
    return [k, v.join('=')];
  }));
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    return payload;
  } catch { return null; }
}

export function getOrigin(req) {
  const host = req.headers['x-forwarded-host'] || req.headers['host'] || '';
  const proto = req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL || 'https://rosalita-business-review.vercel.app';
}
