/**
 * Functional role catalog — the business titles in the restaurant.
 * Used by UserAccount.roleCode and the Admin UI Role Manager.
 *
 * This is a pure-data file — no server-only imports. Safe to import from client components.
 * Kept separate from persons.ts because roles are a catalog of titles, not people.
 */

export interface FunctionalRole {
  code: string;
  name: string;
  isPlatformAdmin?: boolean;
}

export const FUNCTIONAL_ROLES: FunctionalRole[] = [
  { code: 'platform-admin', name: 'Platform Admin', isPlatformAdmin: true },
  { code: 'finance', name: 'Finance' },
  { code: 'ceo', name: 'CEO' },
  { code: 'entertainment', name: 'Entertainment' },
  { code: 'operations', name: 'Operations / Data' },
  { code: 'compliance', name: 'Compliance / Permits' },
];
