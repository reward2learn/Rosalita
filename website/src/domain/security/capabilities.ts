/**
 * Capability catalog for group-based authorization.
 *
 * A capability is a fine-grained permission code of the form `<area>:<access>`
 * (e.g. `financials:write`). Groups carry a set of capability codes; a user's
 * effective capabilities are the union of all their groups' capabilities.
 * Platform admins are implicitly granted every capability (wildcard `*`).
 *
 * Routes should guard with `requireCapability`, `requireRead(area)`, or
 * `requireWrite(area)` from `@/lib/auth/guards` rather than checking groups
 * directly, so the read/write distinction is enforced per group.
 */

export type CapabilityAccess = 'read' | 'write' | 'use';

export interface CapabilityArea {
  /** Area key, e.g. "financials". */
  area: string;
  /** Human label for the UI. */
  label: string;
  /** Access variants available for this area. */
  accesses: CapabilityAccess[];
}

/** Canonical list of protectable areas and their access variants. */
export const CAPABILITY_AREAS: CapabilityArea[] = [
  { area: 'metrics', label: 'Metrics & Daily Stats', accesses: ['read', 'write'] },
  { area: 'financials', label: 'Financial Overview & Actuals', accesses: ['read', 'write'] },
  { area: 'tasks', label: 'Task Tracking', accesses: ['read', 'write'] },
  { area: 'pos', label: 'POS / Receipt Parsing', accesses: ['use'] },
  { area: 'conversations', label: 'Chat Conversations', accesses: ['read', 'write'] },
  { area: 'settings', label: 'App Settings (web search, etc.)', accesses: ['write'] },
  { area: 'config', label: 'Config & Secrets (OpenAI key, reseed)', accesses: ['write'] },
  { area: 'users', label: 'User Accounts Admin', accesses: ['write'] },
  { area: 'groups', label: 'Security Groups Admin', accesses: ['write'] },
];

/** Build a capability code from an area + access. */
export function capability(area: string, access: CapabilityAccess): string {
  return `${area}:${access}`;
}

/** Wildcard meaning "all capabilities" (granted to platform admins). */
export const ALL_CAPABILITIES = '*';

/** Expand a permission set, resolving the `*` wildcard to every known capability. */
export function expandCapabilities(permissions: string[] | null | undefined): Set<string> {
  const set = new Set<string>();
  for (const p of permissions ?? []) {
    if (p === ALL_CAPABILITIES) {
      for (const a of CAPABILITY_AREAS) {
        for (const acc of a.accesses) set.add(capability(a.area, acc));
      }
      continue;
    }
    set.add(p);
  }
  return set;
}

/** True when the given permission set grants `cap`. */
export function grantsCapability(permissions: string[] | null | undefined, cap: string): boolean {
  const perms = permissions ?? [];
  if (perms.includes(ALL_CAPABILITIES)) return true;
  return perms.includes(cap);
}

/** True when the permission set grants `<area>:read` (or the wildcard). */
export function grantsRead(permissions: string[] | null | undefined, area: string): boolean {
  return grantsCapability(permissions, capability(area, 'read'));
}

/** True when the permission set grants `<area>:write` (or the wildcard). */
export function grantsWrite(permissions: string[] | null | undefined, area: string): boolean {
  return grantsCapability(permissions, capability(area, 'write'));
}
