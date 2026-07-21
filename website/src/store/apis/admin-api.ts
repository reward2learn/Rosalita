import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { RoleConfigView } from '@/app/api/admin/roles/route';
import type { AdminConversationView } from '@/app/api/admin/conversations/route';
import type { AdminUserView } from '@/app/api/admin/users/route';
import type { AdminGroupView } from '@/app/api/admin/groups/route';

export const adminApi = createApi({
  reducerPath: 'adminApi',
  baseQuery,
  tagTypes: ['RoleConfig', 'AdminConversations', 'AdminUsers', 'AdminGroups'],
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
    listAdminConversations: builder.query<
      ApiEnvelope<{ conversations: AdminConversationView[] }>,
      { archived?: boolean; owner?: string; limit?: number } | void
    >({
      query: (params) => ({
        url: 'admin/conversations',
        params: {
          ...(params?.archived ? { archived: 'true' } : {}),
          ...(params?.owner ? { owner: params.owner } : {}),
          ...(params?.limit ? { limit: params.limit } : {}),
        },
      }),
      providesTags: ['AdminConversations'],
    }),
    archiveAdminConversation: builder.mutation<
      ApiEnvelope<{ id: number; archived: boolean }>,
      { id: number; archived: boolean }
    >({
      query: ({ id, archived }) => ({
        url: `admin/conversations?id=${id}&archived=${archived}`,
        method: 'PATCH',
      }),
      invalidatesTags: ['AdminConversations'],
    }),
    listAdminUsers: builder.query<ApiEnvelope<{ users: AdminUserView[] }>, void>({
      query: () => 'admin/users',
      providesTags: ['AdminUsers'],
    }),
    updateAdminUser: builder.mutation<
      ApiEnvelope<{ id: string; updated: boolean }>,
      { id: string; email?: string; isActive?: boolean; roleCode?: string | null; groupCodes?: string[]; pin?: string }
    >({
      query: (body) => ({
        url: 'admin/users',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminUsers', 'RoleConfig'],
    }),
    deleteAdminUser: builder.mutation<
      ApiEnvelope<{ id: string; deleted: boolean }>,
      { id: string; sub: string }
    >({
      query: ({ id }) => ({
        url: `admin/users?id=${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AdminUsers'],
    }),
    listAdminGroups: builder.query<ApiEnvelope<{ groups: AdminGroupView[]; defaults: string[] }>, void>({
      query: () => 'admin/groups',
      providesTags: ['AdminGroups'],
    }),
    createAdminGroup: builder.mutation<
      ApiEnvelope<AdminGroupView>,
      { code: string; name: string; description?: string; permissions?: string[] }
    >({
      query: (body) => ({
        url: 'admin/groups',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AdminGroups'],
    }),
    updateAdminGroup: builder.mutation<
      ApiEnvelope<{ code: string; updated: boolean }>,
      { code: string; name?: string; description?: string; permissions?: string[] }
    >({
      query: (body) => ({
        url: 'admin/groups',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['AdminGroups'],
    }),
  }),
});

export const {
  useListRoleConfigsQuery,
  useSetRolePinMutation,
  useListAdminConversationsQuery,
  useArchiveAdminConversationMutation,
  useListAdminUsersQuery,
  useUpdateAdminUserMutation,
  useDeleteAdminUserMutation,
  useListAdminGroupsQuery,
  useCreateAdminGroupMutation,
  useUpdateAdminGroupMutation,
} = adminApi;
