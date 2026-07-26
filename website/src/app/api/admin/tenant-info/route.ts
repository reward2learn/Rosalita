/**
 * Tenant Info API — GET /api/admin/tenant-info
 *
 * Returns the FULL deploy payload as saved by the tokenizmyapp deploy endpoint.
 * Reads from app_config (primary) and app_settings (fallback) in the tenant's own DB.
 *
 * This is the tenant-side counterpart to:
 *   POST https://tokenizmyapp.vercel.app/api/admin/tenants/[slug]/deploy
 *
 * The deploy endpoint writes full config to app_config + app_settings via
 * upsertFullTenantConfig(). This endpoint reads it back so the tenant-info tab
 * in /admin shows exactly what the tenant administrator deployed — no hardcoded values.
 */

import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonError, jsonOk } from '@/lib/api/response';
import { getTenantConfig } from '@shared/lib/config/tenant';

export const dynamic = 'force-dynamic';

interface TenantDeployInfo {
  /** Core tenant identity */
  slug: string;
  displayName: string;
  template: string;

  /** Branding */
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  logoUrl: string | null;

  /** Full config payload from app_config (written by deploy endpoint) */
  config: Record<string, unknown> | null;

  /** Raw metadata from app_settings */
  metadata: Record<string, unknown> | null;

  /** Deploy timestamps */
  lastDeployed: string | null;
  lastUpdated: string | null;
  deployedTemplate: string | null;
  amendmentReason: string | null;

  /** Source: which table(s) the data comes from */
  source: 'app_config' | 'app_settings' | 'env_fallback';

  /** Status */
  success: boolean;
}

export async function GET(): Promise<NextResponse> {
  const guard = await requireWriteAuth();
  if (!guard.ok) return guard.response;

  const envTenant = getTenantConfig();

  try {
    const { PrismaClient } = await import('@/generated/prisma');
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

    if (!url) {
      // No DB — return env-only info
      return jsonOk(buildEnvFallback(envTenant));
    }

    const prisma = new PrismaClient({ datasources: { db: { url } } });

    try {
      // 1) Try app_config (full deploy payload, JSONB)
      const configRow = await prisma.$queryRawUnsafe<{ id: string; data: unknown; updated_at: Date }[]>(
        `SELECT id, data, updated_at FROM app_config WHERE id = 'main'`
      );

      // 2) Also read app_settings (always available)
      const settingsRow = await prisma.$queryRawUnsafe<{
        id: string;
        tenant_slug: string;
        tenant_display_name: string;
        tenant_template: string;
        tenant_metadata: unknown;
        brand_logo_text: string;
        brand_logo_url: string | null;
        brand_primary_color: string;
        brand_secondary_color: string;
        updated_at: Date;
      }[]>(
        `SELECT id, tenant_slug, tenant_display_name, tenant_template, tenant_metadata,
                brand_logo_text, brand_logo_url, brand_primary_color, brand_secondary_color,
                updated_at
         FROM app_settings
         WHERE id = $1
         LIMIT 1`,
        envTenant.slug
      );

      // Merge: app_config has the full payload, app_settings has structured fields
      if (configRow.length > 0 && settingsRow.length > 0) {
        const config = configRow[0];
        const settings = settingsRow[0];
        const configData = config.data as Record<string, unknown> ?? {};

        const info: TenantDeployInfo = {
          slug: settings.tenant_slug || envTenant.slug,
          displayName: settings.tenant_display_name || (configData.displayName as string) || envTenant.displayName,
          template: settings.tenant_template || (configData.template as string) || 'default',
          primaryColor: settings.brand_primary_color || (configData.primaryColor as string) || '#eb3d28',
          secondaryColor: settings.brand_secondary_color || (configData.secondaryColor as string) || '#0af9fe',
          logoText: settings.brand_logo_text || '',
          logoUrl: settings.brand_logo_url || null,
          config: configData,
          metadata: settings.tenant_metadata as Record<string, unknown> | null,
          lastDeployed: (configData.lastDeployed as string) || null,
          lastUpdated: config.updated_at?.toISOString() || null,
          deployedTemplate: (configData.deployedTemplate as string) || settings.tenant_template || null,
          amendmentReason: (configData.amendmentReason as string) || null,
          source: 'app_config',
          success: true,
        };
        return jsonOk(info);
      }

      // 3) Fallback: app_settings only
      if (settingsRow.length > 0) {
        const settings = settingsRow[0];
        const info: TenantDeployInfo = {
          slug: settings.tenant_slug || envTenant.slug,
          displayName: settings.tenant_display_name || envTenant.displayName,
          template: settings.tenant_template || 'default',
          primaryColor: settings.brand_primary_color || '#eb3d28',
          secondaryColor: settings.brand_secondary_color || '#0af9fe',
          logoText: settings.brand_logo_text || '',
          logoUrl: settings.brand_logo_url || null,
          config: null,
          metadata: settings.tenant_metadata as Record<string, unknown> | null,
          lastDeployed: null,
          lastUpdated: settings.updated_at?.toISOString() || null,
          deployedTemplate: settings.tenant_template || null,
          amendmentReason: null,
          source: 'app_settings',
          success: true,
        };
        return jsonOk(info);
      }

      // 4) Nothing in DB — return env defaults
      return jsonOk(buildEnvFallback(envTenant));

    } finally {
      await prisma.$disconnect();
    }
  } catch (err) {
    console.error('[tenant-info] Error reading deploy data:', err);
    // Last resort: env fallback
    return jsonOk(buildEnvFallback(envTenant));
  }
}

function buildEnvFallback(envTenant: ReturnType<typeof getTenantConfig>): TenantDeployInfo {
  return {
    slug: envTenant.slug,
    displayName: envTenant.displayName,
    template: 'default',
    primaryColor: '#eb3d28',
    secondaryColor: '#0af9fe',
    logoText: '',
    logoUrl: null,
    config: null,
    metadata: null,
    lastDeployed: null,
    lastUpdated: null,
    deployedTemplate: null,
    amendmentReason: null,
    source: 'env_fallback',
    success: true,
  };
}
