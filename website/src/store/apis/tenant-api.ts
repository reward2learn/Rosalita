import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface TenantEntry {
  id: string;
  slug: string;
  displayName: string;
  template: string;
  status: 'draft' | 'deploying' | 'live' | 'error';
  vercelProjectId: string | null;
  appUrl: string | null;
  dbUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  metadata: Record<string, unknown>;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const tenantApi = createApi({
  reducerPath: 'tenantApi',
  baseQuery,
  tagTypes: ['Tenants'],
  endpoints: (builder) => ({
    listTenants: builder.query<ApiEnvelope<{ tenants: TenantEntry[] }>, { status?: string } | void>({
      query: (params) => {
        const searchParams = new URLSearchParams();
        if (params && 'status' in params && params.status) searchParams.set('status', params.status);
        const qs = searchParams.toString();
        return qs ? `admin/tenants?${qs}` : 'admin/tenants';
      },
      providesTags: ['Tenants'],
    }),

    getTenant: builder.query<ApiEnvelope<{ tenant: TenantEntry }>, string>({
      query: (slug) => `admin/tenants/${slug}`,
      providesTags: (_result, _error, slug) => [{ type: 'Tenants', id: slug }],
    }),

    createTenant: builder.mutation<ApiEnvelope<{ tenant: TenantEntry }>, {
      slug: string;
      displayName: string;
      template?: string;
      primaryColor?: string;
      secondaryColor?: string;
      metadata?: Record<string, unknown>;
    }>({
      query: (body) => ({
        url: 'admin/tenants',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Tenants'],
    }),

    updateTenant: builder.mutation<ApiEnvelope<{ tenant: TenantEntry }>, {
      slug: string;
      displayName?: string;
      template?: string;
      status?: 'draft' | 'deploying' | 'live' | 'error';
      primaryColor?: string;
      secondaryColor?: string;
      appUrl?: string | null;
      vercelProjectId?: string | null;
      dbUrl?: string | null;
      metadata?: Record<string, unknown>;
    }>({
      query: ({ slug, ...body }) => ({
        url: `admin/tenants/${slug}`,
        method: 'PUT',
        body,
      }),
      invalidatesTags: (_result, _error, { slug }) => [{ type: 'Tenants', id: slug }],
    }),

    deleteTenant: builder.mutation<ApiEnvelope<{ deleted: boolean }>, string>({
      query: (slug) => ({
        url: `admin/tenants/${slug}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tenants'],
    }),
  }),
});

export const {
  useListTenantsQuery,
  useGetTenantQuery,
  useCreateTenantMutation,
  useUpdateTenantMutation,
  useDeleteTenantMutation,
} = tenantApi;
