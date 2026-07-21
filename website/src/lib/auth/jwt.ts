import { SignJWT, jwtVerify, type JWTPayload } from 'jose';

export const COOKIE_NAME = 'redruby.session';
export const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type AuthTier = 'pin' | 'google';

export interface SessionClaims extends JWTPayload {
  sub: string;
  tier: AuthTier;
  email?: string;
  name?: string;
  picture?: string;
  authMethod?: AuthTier;
  /** Role code (e.g. "Ama", "Made") for role-scoped sessions; absent for generic admin. */
  roleCode?: string;
  /** True when the session belongs to a platform administrator (Graham / reward2learn). */
  platformAdmin?: boolean;
  /** Security-group codes the user belongs to (used for group-gated API/route access). */
  groups?: string[];
  /** Effective capability codes (e.g. "financials:write"); platform admins carry "*". */
  permissions?: string[];
}

/** True when the session is a platform admin by claim or platform-admin group membership. */
export function sessionIsPlatformAdmin(
  session: Pick<SessionClaims, 'platformAdmin' | 'groups'> | null | undefined,
): boolean {
  if (!session) return false;
  if (session.platformAdmin) return true;
  return (session.groups ?? []).includes('platform-admin');
}

function getJwtSecret(): Uint8Array {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY not set');
  // Match legacy auth-lib.js: first 32 chars of hex string as UTF-8 key material
  return new TextEncoder().encode(key.slice(0, 32));
}

export async function signSession(
  payload: Omit<SessionClaims, 'iat' | 'exp'>,
): Promise<string> {
  const tier = payload.tier ?? payload.authMethod;
  if (!tier || (tier !== 'pin' && tier !== 'google')) {
    throw new Error('Session requires tier pin or google');
  }
  return new SignJWT({ ...payload, tier, authMethod: tier })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    const tier = (payload.tier ?? payload.authMethod) as AuthTier | undefined;
    if (!tier || (tier !== 'pin' && tier !== 'google')) return null;
    return { ...payload, tier, sub: String(payload.sub) } as SessionClaims;
  } catch {
    return null;
  }
}
