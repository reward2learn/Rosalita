import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import { PERSONS, resolvePerson } from '@/domain/security/persons';
import { getSecretPlaintext, setSecret } from '@/lib/secrets';

export const maxDuration = 30;

/**
 * Map legacy person codes (from KNOWN_ROLES / seedTaskTracking) to the
 * correct USER_PIN_<sub> key. These are the capitalized codes that task
 * labels use (e.g. 'Lukas' → sub 'lucas' since the user's name is Lucas).
 */
const LEGACY_CODE_TO_SUB: Record<string, string> = Object.fromEntries(
  PERSONS.map((p) => {
    // Most legacy codes are just the sub with first letter capitalized,
    // but Lukas uses the old spelling "Lukas" in task labels while the
    // user's sub is 'lucas'.
    const legacyCode = p.sub === 'lucas' ? 'Lukas' :
      p.sub.charAt(0).toUpperCase() + p.sub.slice(1);
    return [legacyCode, p.sub];
  }),
);

/**
 * Resolve the secret key that stores a role's PIN.
 * Platform-admin roles share the single ADMIN_PIN secret (matching verify-pin);
 * all other roles use USER_PIN_<sub> for the person assigned to that role.
 * Handles both functional role codes (e.g. 'finance' → ama) and legacy
 * person-oriented codes (e.g. 'Lukas' → lucas).
 */
function pinKeyForRole(role: { code: string; isPlatformAdmin: boolean }): string {
  if (role.isPlatformAdmin) return 'ADMIN_PIN';
  // Try functional role code first (e.g. 'finance' → sub='ama').
  const byRole = PERSONS.find((p) => p.roleCode === role.code);
  if (byRole) return `USER_PIN_${byRole.sub}`;
  // Try legacy person code (e.g. 'Lukas' → sub='lucas').
  const legacySub = LEGACY_CODE_TO_SUB[role.code];
  if (legacySub) return `USER_PIN_${legacySub}`;
  // Fallback: treat the code as a sub directly.
  return `USER_PIN_${role.code.toLowerCase()}`;
}

export interface RoleConfigView {
  code: string;
  name: string;
  isPlatformAdmin: boolean;
  email: string | null;
  pinConfigured: boolean;
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  // Platform-admin only for role management.
  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin only', 403);
  }

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  } catch {
    return jsonError('Database unavailable', 503);
  }

  const roles = await db.role.findMany({ orderBy: { code: 'asc' } });
  const views: RoleConfigView[] = [];
  for (const role of roles) {
    const pinKey = pinKeyForRole(role);
    const pinConfigured = (await getSecretPlaintext(pinKey)) != null;
    views.push({
      code: role.code,
      name: role.name,
      isPlatformAdmin: role.isPlatformAdmin,
      email: role.email,
      pinConfigured,
    });
  }
  return jsonOk({ roles: views });
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  if (!sessionIsPlatformAdmin(guard.session)) {
    return jsonError('Platform admin only', 403);
  }

  let db;
  try {
    db = createClient({ tier: guard.session.tier, sub: guard.session.sub });
  } catch {
    return jsonError('Database unavailable', 503);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const { code, pin } = (body ?? {}) as { code?: string; pin?: string };
  if (!code || typeof code !== 'string') {
    return jsonError('code is required', 400);
  }
  if (!pin || typeof pin !== 'string' || pin.trim().length < 3) {
    return jsonError('pin must be at least 3 characters', 400);
  }

  // Resolve the role record to derive the correct PIN secret key (platform
  // admins share ADMIN_PIN; others use ROLE_PIN_<CODE>). This avoids the
  // "Unknown role code" 400 for platform-admin roles like "Graham".
  let role;
  try {
    role = await db.role.findUnique({ where: { code } });
  } catch {
    role = null;
  }
  if (!role) {
    return jsonError(`Unknown role code: ${code}`, 400);
  }
  const key = pinKeyForRole(role);

  try {
    await setSecret(key, pin.trim());
    return jsonOk({ code, configured: true });
  } catch {
    return jsonError('Failed to store PIN', 500);
  }
}
