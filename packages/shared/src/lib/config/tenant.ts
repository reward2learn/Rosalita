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
 *   NEXT_PUBLIC_APP_ID              — suite-mode app id (e.g. "hr", "sales") this
 *                                      specific Vercel deployment serves; unset/empty
 *                                      for single-app tenants and the tenant's own hub.
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
 * Is this deployment the platform's own admin console, rather than a tenant app?
 *
 * The console runs the same codebase as every app it provisions, so a handful
 * of surfaces differ between them — the console sells the product, a tenant app
 * runs a business. Keyed on the slug because it is stamped on every deployment
 * and is the same value the platform uses to identify itself elsewhere.
 */
export function isPlatformApp(): boolean {
  const slug = process.env.NEXT_PUBLIC_TENANT_SLUG?.trim() || DEFAULT_TENANT.slug;
  return slug === DEFAULT_TENANT.slug;
}

/**
 * Resolve this deployment's own suite-mode app id, e.g. "hr" or "sales-reporting".
 * Empty string for single-app tenants and the tenant's own hub deployment —
 * the same "no app scope" sentinel used throughout the business-data tables
 * (FinancialProjection, Task, DailyZReport, etc.) and admin routes.
 */
export function getCurrentAppId(): string {
  return process.env.NEXT_PUBLIC_APP_ID?.trim() || '';
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
 *
 * NEXT_PUBLIC_* env vars are replaced at build time, so they are
 * available on both server and client. Do NOT use typeof window
 * guards here — 'use client' components run SSR on the server,
 * and the typeof window check produces different values between
 * the server render and client hydration, causing React #418.
 */
export function getClientTenantConfig(): TenantConfig {
  return getTenantConfig();
}

/**
 * Build a greeter string for AI prompts, chat, etc.
 * E.g. "Tokeniz My App AI" or "Red Ruby AI"
 */
export function getAssistantName(): string {
  const { displayName } = getTenantConfig();
  return `${displayName} AI`;
}
