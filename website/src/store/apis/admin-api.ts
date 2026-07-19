import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { RoleConfigView } from '@/app/api/admin/roles/route';

export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery,
  tagTypes: ['RoleConfig'],
  endpoints: (builder) => ({
    listRoleConfigs: builder.query<ApiEnvelope<{ roles: RoleConfigView[] }>, void>({
      query: () => 'admin/roles',
      providesTags: ['RoleConfig'],
    }),
    setRolePin: builder.mutation<ApiEnvelope<{ code: string; configured: boolean }>, { code: string; pin: string }>({
      query: (body) => ({
        url: 'admin/roles',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['RoleConfig'],
    }),
  }),
});

export const { useListRoleConfigsQuery, useSetRolePinMutation } = adminApi;
