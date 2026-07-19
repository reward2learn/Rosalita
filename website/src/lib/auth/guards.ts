import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import type { SessionClaims } from '@/lib/auth/jwt';

export type GuardFailure = { ok: false; response: NextResponse };
export type GuardSuccess = { ok: true; session: SessionClaims };
export type GuardResult = GuardSuccess | GuardFailure;

function unauthorized(message = 'Unauthorized'): GuardFailure {
  return {
    ok: false,
    response: NextResponse.json({ success: false, error: message }, { status: 401 }),
  };
}

export async function requireSession(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  return { ok: true, session };
}

export async function requireWriteAuth(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized();
  if (session.tier !== 'pin' && session.tier !== 'google') {
    return unauthorized();
  }
  return { ok: true, session };
}

export async function requireGoogle(request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session || session.tier !== 'google') {
    return unauthorized('Google sign-in required');
  }
  return { ok: true, session };
}

/**
 * Require a session scoped to a specific role code, OR a platform administrator.
 * Used to gate dedicated per-role routes (e.g. /tasks/ama).
 */
export async function requireRole(roleCode: string, request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  if (session.platformAdmin) return { ok: true, session };
  if (session.roleCode && session.roleCode.toLowerCase() === roleCode.toLowerCase()) {
    return { ok: true, session };
  }
  return unauthorized('Not authorized for this role');
}
