import type { DbClient } from '@/lib/db';
import { expandCapabilities } from '@/domain/security/capabilities';

/**
 * Resolve the security-group codes a user belongs to, keyed by auth subject (sub).
 * Returns an empty array when the user has no group memberships or tables are missing.
 */
export async function resolveGroupCodesForSub(db: DbClient, sub: string): Promise<string[]> {
  if (!sub) return [];
  try {
    const rows = await db.$queryRawUnsafe<{ code: string }[]>(
      `SELECT sg.code
       FROM security_groups sg
       JOIN user_groups ug ON ug.group_id = sg.id
       JOIN user_accounts ua ON ua.id = ug.user_id
       WHERE ua.sub = $1;`,
      sub,
    );
    return (rows ?? []).map((r) => r.code);
  } catch {
    return [];
  }
}

/** Upsert a user account row from session identity; returns the persisted account id. */
export async function upsertUserAccount(
  db: DbClient,
  input: { sub: string; email?: string | null; name?: string | null; tier: string; roleCode?: string | null },
): Promise<{ id: string; isActive: boolean }> {
  const result = await db.$queryRawUnsafe<{ id: string; is_active: boolean }[]>(
    `INSERT INTO user_accounts (sub, email, name, tier, role_code, last_seen_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (sub) DO UPDATE
       SET email = COALESCE($2, user_accounts.email),
           name = COALESCE($3, user_accounts.name),
           tier = $4,
           role_code = COALESCE($5, user_accounts.role_code),
           last_seen_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
     RETURNING id, is_active;`,
    input.sub,
    input.email ?? null,
    input.name ?? null,
    input.tier,
    input.roleCode ?? null,
  );
  const row = result[0];
  if (!row) throw new Error('Failed to upsert user account');
  return { id: row.id, isActive: row.is_active };
}

/**
 * Resolve the effective capability set for a user, keyed by auth subject (sub).
 * Capabilities are the union of all the user's groups' permission codes, with
 * the `*` wildcard expanded to every known capability. Returns an empty array
 * when the user has no group memberships or tables are missing.
 */
export async function resolveCapabilitiesForSub(db: DbClient, sub: string): Promise<string[]> {
  if (!sub) return [];
  try {
    const rows = await db.$queryRawUnsafe<{ permissions: string[] | null }[]>(
      `SELECT sg.permissions
       FROM security_groups sg
       JOIN user_groups ug ON ug.group_id = sg.id
       JOIN user_accounts ua ON ua.id = ug.user_id
       WHERE ua.sub = $1;`,
      sub,
    );
    const merged = (rows ?? []).flatMap((r) => r.permissions ?? []);
    return Array.from(expandCapabilities(merged));
  } catch {
    return [];
  }
}

/**
 * One-time backfill: create user_account rows for the operational identities the
 * system already knows (PIN roles + platform admins) so the User Accounts list is
 * populated with prior users even before they re-sign-in. Idempotent on `sub`.
 */
export async function backfillKnownAccounts(
  db: DbClient,
  known: { sub: string; name: string; tier: string; roleCode?: string | null }[],
): Promise<void> {
  for (const k of known) {
    await db.$queryRawUnsafe(
      `INSERT INTO user_accounts (sub, name, tier, role_code, last_seen_at, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (sub) DO UPDATE
         SET name = COALESCE($2, user_accounts.name),
             tier = $3,
             role_code = COALESCE($4, user_accounts.role_code),
             updated_at = CURRENT_TIMESTAMP;`,
      k.sub,
      k.name,
      k.tier,
      k.roleCode ?? null,
    );
  }
}
