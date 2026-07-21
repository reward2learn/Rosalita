import { NextResponse } from 'next/server';
import { createBaseClient, type DbClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureSecurityTables } from '@/lib/db-migrate';
import { resolveCapabilitiesForSub } from '@/domain/security/security-service';
import { setSecret, deleteSecret } from '@/lib/secrets';

export const maxDuration = 30;

export interface AdminUserView {
  id: string;
  sub: string;
  email: string | null;
  name: string | null;
  tier: string;
  roleCode: string | null;
  isActive: boolean;
  groups: string[];
  permissions: string[];
  lastSeenAt: string | null;
  createdAt: string;
}

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let db;
  try {
    db = createBaseClient();
    // Ensure tables exist but don't backfill known accounts here — that
    // would re-create users that an admin has deliberately deleted.
    await ensureSecurityTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    const rows = await db.$queryRawUnsafe<{
      id: string;
      sub: string;
      email: string | null;
      name: string | null;
      tier: string;
      role_code: string | null;
      is_active: boolean;
      last_seen_at: Date | null;
      created_at: Date;
    }[]>(`SELECT id, sub, email, name, tier, role_code, is_active, last_seen_at, created_at
         FROM user_accounts
         ORDER BY created_at DESC
         LIMIT 200;`);

    const users: AdminUserView[] = await Promise.all(
      rows.map(async (r) => ({
        id: r.id,
        sub: r.sub,
        email: r.email,
        name: r.name,
        tier: r.tier,
        roleCode: r.role_code,
        isActive: r.is_active,
        groups: await resolveGroups(db, r.id),
        permissions: await resolveCapabilities(db, r.sub),
        lastSeenAt: r.last_seen_at ? r.last_seen_at.toISOString() : null,
        createdAt: r.created_at.toISOString(),
      })),
    );

    return jsonOk({ users });
  } catch (err) {
    console.error('[admin/users] GET error:', err);
    return jsonError('Failed to load users', 500);
  }
}

async function resolveGroups(db: DbClient, userId: string): Promise<string[]> {
  try {
    const rows = await db.$queryRawUnsafe<{ code: string }[]>(
      `SELECT sg.code FROM security_groups sg
       JOIN user_groups ug ON ug.group_id = sg.id
       WHERE ug.user_id = $1;`,
      userId,
    );
    return (rows ?? []).map((r) => r.code);
  } catch {
    return [];
  }
}

async function resolveCapabilities(db: DbClient, sub: string): Promise<string[]> {
  try {
    return await resolveCapabilitiesForSub(db, sub);
  } catch {
    return [];
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const { id, email, isActive, roleCode, groupCodes, pin } = (body ?? {}) as {
    id?: string;
    email?: string;
    isActive?: boolean;
    roleCode?: string | null;
    groupCodes?: string[];
    pin?: string;
  };

  if (!id || typeof id !== 'string') return jsonError('id is required', 400);

  let db;
  try {
    db = createBaseClient();
    await ensureSecurityTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    if (typeof isActive === 'boolean' || roleCode !== undefined || email !== undefined) {
      await db.$executeRawUnsafe(
        `UPDATE user_accounts
         SET is_active = COALESCE($1, is_active),
             role_code = COALESCE($2, role_code),
             email = COALESCE($3, email),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $4;`,
        typeof isActive === 'boolean' ? isActive : null,
        roleCode === null ? null : (roleCode ?? null),
        email === undefined ? null : email,
        id,
      );
    }

    if (Array.isArray(groupCodes)) {
      await db.$executeRawUnsafe(`DELETE FROM user_groups WHERE user_id = $1;`, id);
      for (const code of groupCodes) {
        await db.$executeRawUnsafe(
          `INSERT INTO user_groups (user_id, group_id)
           SELECT $1, sg.id FROM security_groups sg WHERE sg.code = $2
           ON CONFLICT (user_id, group_id) DO NOTHING;`,
          id,
          code,
        );
      }
    }

    // Set PIN for this user (stored as USER_PIN_<sub> in secrets table).
    if (pin && pin.trim().length >= 3) {
      const user = await db.$queryRawUnsafe<{ sub: string }[]>(
        `SELECT sub FROM user_accounts WHERE id = $1;`,
        id,
      );
      const sub = user[0]?.sub;
      if (sub) {
        await setSecret(`USER_PIN_${sub}`, pin.trim());
      }
    }

    return jsonOk({ id, updated: true });
  } catch (err) {
    console.error('[admin/users] POST error:', err);
    return jsonError('Failed to update user', 500);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return jsonError('id query param is required', 400);

  let db;
  try {
    db = createBaseClient();
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    // Fetch the sub before deleting so we can remove their PIN secret.
    const user = await db.$queryRawUnsafe<{ sub: string }[]>(
      `SELECT sub FROM user_accounts WHERE id = $1;`,
      id,
    );
    // Cascade deletes user_groups rows automatically.
    await db.$executeRawUnsafe(`DELETE FROM user_accounts WHERE id = $1;`, id);
    // Also delete the PIN secret so the user cannot re-authenticate via PIN.
    if (user[0]?.sub) {
      await deleteSecret(`USER_PIN_${user[0].sub}`).catch(() => {});
    }
    return jsonOk({ id, deleted: true });
  } catch (err) {
    console.error('[admin/users] DELETE error:', err);
    return jsonError('Failed to delete user', 500);
  }
}
