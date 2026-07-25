/**
 * Public Tenant Config API
 *
 * GET /api/brand-config
 *   Returns: { tenantSlug, tenantDisplayName, tenantTemplate, brandLogoText, brandLogoUrl, brandPrimaryColor, brandSecondaryColor }
 *   No auth required — called by the header and theme on every page load.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/db';
import { getAppSettings } from '@/domain/config/app-settings-service';
import { getTenantConfig } from '@shared/lib/config/tenant';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  // Determine which tenant's config to read from env vars
  const envTenant = getTenantConfig();

  // Graceful fallback when no DB is configured (local dev, demo mode)
  if (!process.env.POSTGRES_URL && !process.env.DATABASE_URL) {
    return NextResponse.json({
      tenantSlug: envTenant.slug,
      tenantDisplayName: envTenant.displayName,
      tenantTemplate: 'default',
      brandLogoText: '',
      brandLogoUrl: '',
      brandPrimaryColor: '#eb3d28',
      brandSecondaryColor: '#0af9fe',
    });
  }

  try {
    const db = createClient();
    // Pass tenant slug so each deployed app gets its own brand config
    const settings = await getAppSettings(db, envTenant.slug);
    return NextResponse.json({
      tenantSlug: settings.tenantSlug || envTenant.slug,
      tenantDisplayName: settings.tenantDisplayName || envTenant.displayName,
      tenantTemplate: settings.tenantTemplate || 'default',
      brandLogoText: settings.brandLogoText,
      brandLogoUrl: settings.brandLogoUrl,
      brandPrimaryColor: settings.brandPrimaryColor,
      brandSecondaryColor: settings.brandSecondaryColor,
    });
  } catch (err) {
    console.error('[brand-config] Failed to read:', err);
    // Return defaults so the UI never breaks
    return NextResponse.json({
      tenantSlug: envTenant.slug,
      tenantDisplayName: envTenant.displayName,
      tenantTemplate: 'default',
      brandLogoText: '',
      brandLogoUrl: '',
      brandPrimaryColor: '#eb3d28',
      brandSecondaryColor: '#0af9fe',
    });
  }
}
