/**
 * Tenant Info API — RTK Query
 *
 * Reads the full deploy payload stored in the tenant's app_config table.
 * This is the client-side counterpart to:
 *   GET /api/admin/tenant-info
 *
 * What the tenant administrator deployed via tokenizmyapp
 * is exactly what this API returns — no hardcoded values.
 */

import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@shared/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface TenantDeployInfo {
  slug: string;
  displayName: string;
  template: string;
  primaryColor: string;
  secondaryColor: string;
  logoText: string;
  logoUrl: string | null;
  config: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  lastDeployed: string | null;
  lastUpdated: string | null;
  deployedTemplate: string | null;
  amendmentReason: string | null;
  source: 'app_config' | 'app_settings' | 'env_fallback';
  success: boolean;
}

export const tenantInfoApi = createApi({
  reducerPath: 'tenantInfoApi',
  baseQuery,
  endpoints: (builder) => ({
    getTenantInfo: builder.query<ApiEnvelope<TenantDeployInfo>, void>({
      query: () => 'admin/tenant-info',
    }),
  }),
});

export const { useGetTenantInfoQuery } = tenantInfoApi;
