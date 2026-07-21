/**
 * Known persons — the operational identities in the system.
 * Shared source of truth for seed-runner, auth, db-migrate, and SignInPanel.
 * Each person has a role (functional title), PIN (stored in secrets as USER_PIN_<sub>),
 * and is managed through the User Accounts admin UI.
 *
 * This is a pure-data file — no server-only imports. Safe to import from client components.
 */

export interface Person {
  sub: string;
  name: string;
  roleCode: string;
  roleName: string;
  isPlatformAdmin?: boolean;
  email?: string;
}

export const PERSONS: Person[] = [
  {
    sub: 'admin',
    name: 'Admin',
    roleCode: 'platform-admin',
    roleName: 'Platform Admin',
    isPlatformAdmin: true,
    email: 'reward2learn@gmail.com',
  },
  {
    sub: 'ama',
    name: 'Ama',
    roleCode: 'finance',
    roleName: 'Finance',
  },
  {
    sub: 'graham',
    name: 'Graham',
    roleCode: 'ceo',
    roleName: 'CEO',
    email: 'graham@starworksglobal.com',
  },
  {
    sub: 'james',
    name: 'James',
    roleCode: 'entertainment',
    roleName: 'Entertainment',
  },
  {
    sub: 'lucas',
    name: 'Lucas',
    roleCode: 'operations',
    roleName: 'Operations / Data',
  },
  {
    sub: 'made',
    name: 'Made',
    roleCode: 'compliance',
    roleName: 'Compliance / Permits',
  },
];

/** Resolve a person by `sub` (lowercased). */
export function resolvePerson(sub: string): Person | undefined {
  return PERSONS.find((p) => p.sub === sub.toLowerCase());
}

/** Resolve a person by email (case-insensitive). Used by Google sign-in. */
export function resolvePersonByEmail(email: string | undefined): Person | null {
  if (!email) return null;
  const lower = email.toLowerCase();
  return PERSONS.find((p) => p.email && p.email.toLowerCase() === lower) ?? null;
}

/** List active persons as known-account rows for backfill. */
export function listKnownAccounts(): { sub: string; name: string; tier: string; roleCode?: string | null }[] {
  return PERSONS.map((p) => ({
    sub: p.sub,
    name: p.name,
    tier: 'pin',
    roleCode: p.roleCode,
  }));
}
