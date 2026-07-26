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
 *
 * Auto-creates app_config + app_settings tables if they don't exist yet (idempotent).
 */

import { NextResponse } from 'next/server';
import { requireWriteAuth } from '@/lib/auth/guards';
import { jsonOk } from '@/lib/api/response';
import { getTenantConfig } from '@shared/lib/config/tenant';
import { Pool } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

interface TenantDeployInfo {
  slug: string;
  displayName: string;
  template: string;
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  logoUrl: string | null;
  /** Full config payload from app_config (written by deploy endpoint) */
  config: Record<string, unknown> | null;
  /** Raw metadata from app_settings */
  metadata: Record<string, unknown> | null;
  lastDeployed: string | null;
  lastUpdated: string | null;
  deployedTemplate: string | null;
  amendmentReason: string | null;
  /** Source: which table(s) the data comes from */
  source: 'app_config' | 'app_settings' | 'env_fallback';
  /** Diagnostic info */
  _diagnostic?: {
    configCount: number;
    settingsCount: number;
    configRowLength: number;
    settingsRowLength: number;
  };
  success: boolean;
}

// Table creation is done inline in GET using neon()`

export async function GET(request: Request): Promise<NextResponse> {
  const guard = await requireWriteAuth(request);
  if (!guard.ok) return guard.response;

  const envTenant = getTenantConfig();

  try {
    const url = process.env.POSTGRES_URL ?? process.env.DATABASE_URL;

    if (!url) {
      console.log('[tenant-info] No database URL found');
      return jsonOk(buildEnvFallback(envTenant));
    }

    // Use @neondatabase/serverless Pool for reliable raw SQL queries
    // Using non-pooling URL to avoid PgBouncer prepared statement issues
    const dbUrl = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL || process.env.DATABASE_URL;
    const pool = new Pool({ connectionString: dbUrl, max: 1 });

    try {
      // Ensure both tables exist (idempotent)
      await pool.query(`CREATE TABLE IF NOT EXISTS app_config (
        id TEXT PRIMARY KEY DEFAULT 'main',
        data JSONB NOT NULL DEFAULT '{}',
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )`);
      await pool.query(`CREATE TABLE IF NOT EXISTS app_settings (
        id TEXT PRIMARY KEY,
        web_search_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        tenant_slug TEXT NOT NULL DEFAULT 'tokenizmyapp',
        tenant_display_name TEXT NOT NULL DEFAULT '',
        tenant_template TEXT NOT NULL DEFAULT 'default',
        tenant_metadata JSONB DEFAULT '{}',
        brand_logo_text TEXT NOT NULL DEFAULT '',
        brand_logo_url TEXT NOT NULL DEFAULT '',
        brand_primary_color TEXT NOT NULL DEFAULT '#eb3d28',
        brand_secondary_color TEXT NOT NULL DEFAULT '#0af9fe',
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`);

      // Diagnostic: check row counts
      const configCountResult = await pool.query('SELECT COUNT(*)::int as cnt FROM app_config');
      const settingsCountResult = await pool.query('SELECT COUNT(*)::int as cnt FROM app_settings');
      const configCount = configCountResult.rows[0]?.cnt ?? 0;
      const settingsCount = settingsCountResult.rows[0]?.cnt ?? 0;
      console.log(`[tenant-info] config_count=${configCount}, settings_count=${settingsCount}, slug=${envTenant.slug}`);

      // 1) Try app_config (full deploy payload, JSONB)
      const configResult = await pool.query(`SELECT id, data, updated_at FROM app_config WHERE id = 'main'`);
      const configRow = configResult.rows;

      // 2) Also read app_settings (always available)
      const settingsResult = await pool.query(`SELECT id, tenant_slug, tenant_display_name, tenant_template, tenant_metadata,
               brand_logo_text, brand_logo_url, brand_primary_color, brand_secondary_color,
               updated_at FROM app_settings WHERE id = $1 LIMIT 1`, [envTenant.slug]);
      const settingsRow = settingsResult.rows;

      // Merge: app_config has the full payload, app_settings has structured fields
      if (configRow.length > 0 && settingsRow.length > 0) {
        const config = configRow[0];
        const settings = settingsRow[0];
        const configData = (config.data as Record<string, unknown>) ?? {};

        const info: TenantDeployInfo = {
          slug: settings.tenant_slug || envTenant.slug,
          displayName: (settings.tenant_display_name || (configData.displayName as string) || envTenant.displayName) as string,
          template: (settings.tenant_template || (configData.template as string) || 'default') as string,
          primaryColor: (settings.brand_primary_color || (configData.primaryColor as string) || '#eb3d28') as string,
          secondaryColor: (settings.brand_secondary_color || (configData.secondaryColor as string) || '#0af9fe') as string,
          logoText: settings.brand_logo_text || '',
          logoUrl: settings.brand_logo_url || null,
          config: configData,
          metadata: settings.tenant_metadata as Record<string, unknown> | null,
          lastDeployed: (configData.lastDeployed as string) || null,
          lastUpdated: (config.updated_at ? new Date(config.updated_at).toISOString() : null) as string | null,
          deployedTemplate: ((configData.deployedTemplate as string) || settings.tenant_template || null) as string | null,
          amendmentReason: (configData.amendmentReason as string) || null,
          source: 'app_config',
          _diagnostic: {
            configCount: Number(configCount),
            settingsCount: Number(settingsCount),
            configRowLength: configRow.length,
            settingsRowLength: settingsRow.length,
          },
          success: true,
        };
        return jsonOk(info);
      }

      // 3) Fallback: app_settings only
      if (settingsRow.length > 0) {
        const settings = settingsRow[0];
        const info: TenantDeployInfo = {
          slug: settings.tenant_slug || envTenant.slug,
          displayName: (settings.tenant_display_name || envTenant.displayName) as string,
          template: (settings.tenant_template || 'default') as string,
          primaryColor: (settings.brand_primary_color || '#eb3d28') as string,
          secondaryColor: (settings.brand_secondary_color || '#0af9fe') as string,
          logoText: settings.brand_logo_text || '',
          logoUrl: settings.brand_logo_url || null,
          config: null,
          metadata: settings.tenant_metadata as Record<string, unknown> | null,
          lastDeployed: null,
          lastUpdated: (settings.updated_at ? new Date(settings.updated_at).toISOString() : null) as string | null,
          deployedTemplate: (settings.tenant_template || null) as string | null,
          amendmentReason: null,
          source: 'app_settings',
          _diagnostic: {
            configCount: Number(configCount),
            settingsCount: Number(settingsCount),
            configRowLength: configRow.length,
            settingsRowLength: settingsRow.length,
          },
          success: true,
        };
        return jsonOk(info);
      }

      // 4) Nothing in DB — return env defaults
      const fallbackInfo = buildEnvFallback(envTenant);
      fallbackInfo._diagnostic = {
        configCount: Number(configCount),
        settingsCount: Number(settingsCount),
        configRowLength: configRow.length,
        settingsRowLength: settingsRow.length,
      };
      return jsonOk(fallbackInfo);

    } finally {
      await pool.end().catch(() => {}); // Cleanup connection pool
    }
  } catch (err) {
    console.error('[tenant-info] Error reading deploy data:', err);
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
    _diagnostic: undefined,
    success: true,
  };
}
