import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { sessionIsPlatformAdmin, type SessionClaims } from '@/lib/auth/jwt';

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
  if (sessionIsPlatformAdmin(session)) return { ok: true, session };
  if (session.roleCode && session.roleCode.toLowerCase() === roleCode.toLowerCase()) {
    return { ok: true, session };
  }
  return unauthorized('Not authorized for this role');
}

/**
 * Require membership in a security group (by group code). Platform admins are
 * implicitly granted all groups. Used to gate API calls and routes by group.
 */
export async function requireGroup(groupCode: string, request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  if (sessionIsPlatformAdmin(session)) return { ok: true, session };
  const groups = session.groups ?? [];
  if (groups.includes(groupCode)) return { ok: true, session };
  return unauthorized(`Requires security group: ${groupCode}`);
}

/**
 * Require membership in ANY of the given security groups (by code). Platform
 * admins are implicitly granted all groups. Used when several groups may access
 * a route (e.g. finance data visible to both finance and ops-admin).
 */
export async function requireGroupAny(groupCodes: string[], request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  if (sessionIsPlatformAdmin(session)) return { ok: true, session };
  const groups = session.groups ?? [];
  if (groupCodes.some((code) => groups.includes(code))) return { ok: true, session };
  return unauthorized(`Requires one of security groups: ${groupCodes.join(', ')}`);
}

/**
 * Require a specific capability (e.g. "financials:write"). Platform admins are
 * implicitly granted every capability. Used for fine-grained read/write/API
 * access control layered on top of group membership.
 */
export async function requireCapability(cap: string, request: Request): Promise<GuardResult> {
  const session = await getSessionFromRequest(request);
  if (!session) return unauthorized('Sign in required');
  if (sessionIsPlatformAdmin(session)) return { ok: true, session };
  const perms = session.permissions ?? [];
  if (perms.includes('*') || perms.includes(cap)) return { ok: true, session };
  return unauthorized(`Requires capability: ${cap}`);
}

/** Require `<area>:read` capability. Platform admins pass. */
export async function requireRead(area: string, request: Request): Promise<GuardResult> {
  return requireCapability(`${area}:read`, request);
}

/** Require `<area>:write` capability. Platform admins pass. */
export async function requireWrite(area: string, request: Request): Promise<GuardResult> {
  return requireCapability(`${area}:write`, request);
}
