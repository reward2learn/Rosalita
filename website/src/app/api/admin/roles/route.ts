import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { getSecretPlaintext, setSecret } from '@/lib/secrets';

export const maxDuration = 30;

const ROLE_PIN_KEYS: Record<string, string> = {
  ama: 'ROLE_PIN_AMA',
  made: 'ROLE_PIN_MADE',
  lukas: 'ROLE_PIN_LUKAS',
  james: 'ROLE_PIN_JAMES',
  admin: 'ADMIN_PIN',
};

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
  if (!guard.session.platformAdmin) {
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
    const pinKey = ROLE_PIN_KEYS[role.code.toLowerCase()];
    const pinConfigured = pinKey ? (await getSecretPlaintext(pinKey)) != null : false;
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

  if (!guard.session.platformAdmin) {
    return jsonError('Platform admin only', 403);
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
  const key = ROLE_PIN_KEYS[code.toLowerCase()];
  if (!key) {
    return jsonError(`Unknown role code: ${code}`, 400);
  }
  if (!pin || typeof pin !== 'string' || pin.trim().length < 3) {
    return jsonError('pin must be at least 3 characters', 400);
  }

  try {
    await setSecret(key, pin.trim());
    return jsonOk({ code, configured: true });
  } catch {
    return jsonError('Failed to store PIN', 500);
  }
}
