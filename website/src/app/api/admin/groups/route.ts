import { NextResponse } from 'next/server';
import { createBaseClient } from '@/lib/db';
import { requireWriteAuth } from '@/lib/auth/guards';
import { sessionIsPlatformAdmin } from '@/lib/auth/jwt';
import { jsonError, jsonOk } from '@/lib/api/response';
import { ensureSecurityTables, DEFAULT_SECURITY_GROUPS } from '@/lib/db-migrate';
import { CAPABILITY_AREAS, capability, ALL_CAPABILITIES } from '@/domain/security/capabilities';

export const maxDuration = 30;

export interface AdminGroupView {
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  memberCount: number;
}

/** All valid capability codes (used to validate PATCH payloads). */
export const VALID_CAPABILITIES: string[] = [
  ALL_CAPABILITIES,
  ...CAPABILITY_AREAS.flatMap((a) => a.accesses.map((acc) => capability(a.area, acc))),
];

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let db;
  try {
    db = createBaseClient();
    // Ensure tables exist but don't backfill — that would re-create
    // user_account rows that an admin has deliberately deleted.
    await ensureSecurityTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    const rows = await db.$queryRawUnsafe<{
      code: string;
      name: string;
      description: string | null;
      is_system: boolean;
      permissions: string[] | null;
      member_count: number;
    }[]>(`SELECT sg.code, sg.name, sg.description, sg.is_system, sg.permissions,
                COUNT(ug.id)::int AS member_count
          FROM security_groups sg
          LEFT JOIN user_groups ug ON ug.group_id = sg.id
          GROUP BY sg.code, sg.name, sg.description, sg.is_system, sg.permissions
          ORDER BY sg.is_system DESC, sg.name ASC;`);

    const groups: AdminGroupView[] = rows.map((r: { code: string; name: string; description: string | null; is_system: boolean; permissions: string[] | null; member_count: number; }) => ({
      code: r.code,
      name: r.name,
      description: r.description,
      isSystem: r.is_system,
      permissions: r.permissions ?? [],
      memberCount: r.member_count,
    }));

    return jsonOk({ groups, defaults: DEFAULT_SECURITY_GROUPS.map((g) => g.code) });
  } catch (err) {
    console.error('[admin/groups] GET error:', err);
    return jsonError('Failed to load groups', 500);
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

  const { code, name, description, permissions } = (body ?? {}) as {
    code?: string;
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!code || !name) return jsonError('code and name are required', 400);
  if (!/^[a-z0-9-]+$/.test(code)) {
    return jsonError('code must be lowercase letters, numbers, or hyphens', 400);
  }

  const perms = normalizePermissions(permissions);

  let db;
  try {
    db = createBaseClient();
    await ensureSecurityTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    await db.$executeRawUnsafe(
      `INSERT INTO security_groups (code, name, description, is_system, permissions)
       VALUES ($1, $2, $3, false, $4)
       ON CONFLICT (code) DO UPDATE SET name = $2, description = $3, permissions = $4;`,
      code,
      name,
      description ?? null,
      perms,
    );
    return jsonOk({ code, name, description: description ?? null, isSystem: false, permissions: perms, memberCount: 0 });
  } catch (err) {
    console.error('[admin/groups] POST error:', err);
    return jsonError('Failed to create group', 500);
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;
  if (!sessionIsPlatformAdmin(guard.session)) return jsonError('Platform admin only', 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON', 400);
  }

  const { code, name, description, permissions } = (body ?? {}) as {
    code?: string;
    name?: string;
    description?: string;
    permissions?: string[];
  };

  if (!code) return jsonError('code is required', 400);

  const perms = normalizePermissions(permissions);

  let db;
  try {
    db = createBaseClient();
    await ensureSecurityTables(db);
  } catch {
    return jsonError('Database unavailable', 503);
  }

  try {
    const affected = await db.$executeRawUnsafe(
      `UPDATE security_groups
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           permissions = $4
       WHERE code = $1;`,
      code,
      name ?? null,
      description ?? null,
      perms,
    );
    if (affected === 0) return jsonError('Group not found', 404);
    return jsonOk({ code, name: name ?? null, description: description ?? null, permissions: perms, updated: true });
  } catch (err) {
    console.error('[admin/groups] PATCH error:', err);
    return jsonError('Failed to update group', 500);
  }
}

/** Validate + de-duplicate a permission list against the known capability catalog. */
function normalizePermissions(permissions: string[] | undefined): string[] {
  if (!Array.isArray(permissions)) return [];
  const set = new Set<string>();
  for (const p of permissions) {
    if (typeof p === 'string' && VALID_CAPABILITIES.includes(p)) set.add(p);
  }
  return Array.from(set);
}
