/**
 * Tenant Configuration
 *
 * Centralized tenant identity — reads from environment variables with
 * fallback to defaults. Used by server components, API routes, and
 * client components to create a generic, multi-tenant application.
 *
 * Environment Variables:
 *   NEXT_PUBLIC_TENANT_SLUG         — subdomain slug (e.g. "redrubybali")
 *   NEXT_PUBLIC_TENANT_DISPLAY_NAME — display name (e.g. "Red Ruby Bali")
 *   NEXT_PUBLIC_TENANT_DESCRIPTION  — app description / tagline
 *   NEXT_PUBLIC_APP_URL             — canonical app URL (overrides slug-based derivation)
 */

/** Default values when no tenant env vars are set. */
export const DEFAULT_TENANT = {
  slug: 'tokenizmyapp' as const,
  displayName: 'Tokeniz My App' as const,
  description: 'Business operations dashboard' as const,
  appTitle: 'Tokeniz My App' as const,
};

export interface TenantConfig {
  /** Subdomain slug — used for URL derivation (e.g. "redrubybali") */
  slug: string;
  /** Human-readable business name (e.g. "Red Ruby Bali") */
  displayName: string;
  /** Meta description / tagline */
  description: string;
  /** HTML <title> — defaults to displayName if not explicitly set */
  appTitle: string;
}

/**
 * Resolve tenant config from environment variables.
 * Server-safe — only reads process.env, no DB calls.
 */
export function getTenantConfig(): TenantConfig {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || DEFAULT_TENANT.slug;
  const displayName = process.env.NEXT_PUBLIC_TENANT_DISPLAY_NAME?.trim() || DEFAULT_TENANT.displayName;
  const description = process.env.NEXT_PUBLIC_TENANT_DESCRIPTION?.trim() || `${displayName} ${DEFAULT_TENANT.description}`;
  const appTitle = process.env.NEXT_PUBLIC_TENANT_APP_TITLE?.trim() || displayName;

  return { slug, displayName, description, appTitle };
}

/**
 * Resolve the canonical application URL.
 *
 * Priority order:
 *   1. NEXT_PUBLIC_APP_URL env var (explicit override)
 *   2. Derived from tenant slug: https://{slug}.vercel.app
 *   3. Default: https://tokenizmyapp.vercel.app
 */
export function getTenantAppUrl(): string {
  const fromPublic = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '');
  if (fromPublic) return fromPublic;

  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim();
  if (slug && slug !== DEFAULT_TENANT.slug) {
    return `https://${slug}.vercel.app`;
  }

  return `https://${DEFAULT_TENANT.slug}.vercel.app`;
}

/**
 * Check whether the given hostname matches the tenant's expected domain(s).
 * Used for canonical URL resolution in auth redirects and cookie domain checks.
 */
export function isTenantDomain(hostname: string): boolean {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || DEFAULT_TENANT.slug;

  // Match: {slug}.vercel.app or any custom domain (via NEXT_PUBLIC_APP_URL)
  if (hostname.includes(`${slug}.vercel.app`)) return true;

  const canonicalUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (canonicalUrl) {
    try {
      const canonicalHost = new URL(canonicalUrl).hostname;
      if (hostname === canonicalHost) return true;
    } catch { /* ignore parse errors */ }
  }

  // Also match VERCEL_URL for preview deployments
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl && hostname.includes(vercelUrl)) return true;

  return false;
}

/**
 * Client-safe hook to get tenant config from env vars.
 * For dynamic overrides from DB, use the brand-config API instead.
 */
export function getClientTenantConfig(): TenantConfig {
  // On client side, NEXT_PUBLIC_* vars are available
  const slug = (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_TENANT_SLUG
    : undefined)?.trim() || DEFAULT_TENANT.slug;
  const displayName = (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_TENANT_DISPLAY_NAME
    : undefined)?.trim() || DEFAULT_TENANT.displayName;
  const description = (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_TENANT_DESCRIPTION
    : undefined)?.trim() || `${displayName} ${DEFAULT_TENANT.description}`;
  const appTitle = (typeof window !== 'undefined'
    ? process.env.NEXT_PUBLIC_TENANT_APP_TITLE
    : undefined)?.trim() || displayName;

  return { slug, displayName, description, appTitle };
}

/**
 * Build a greeter string for AI prompts, chat, etc.
 * E.g. "Tokeniz My App AI" or "Red Ruby AI"
 */
export function getAssistantName(): string {
  const { displayName } = getTenantConfig();
  return `${displayName} AI`;
}
