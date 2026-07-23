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
  tagTypes: ['RoleConfig', 'AdminConversations', 'AdminUsers', 'AdminGroups', 'SeedData', 'AiContent', 'BrandConfig', 'Navigation'],
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
    /** POST /api/admin/clear-seed — clear all or selected seed tables */
    clearSeed: builder.mutation<ApiEnvelope<{ deleted: Record<string, number>; message: string }>, { mode: 'all'; confirm: string } | { mode: 'selected'; tables: string[]; confirm: string }>({
      query: (body) => ({
        url: 'admin/clear-seed',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['SeedData'],
    }),
    /** GET /api/admin/ai-content — AI content generation status */
    getAiContent: builder.query<ApiEnvelope<unknown>, void>({
      query: () => 'admin/ai-content',
      providesTags: ['AiContent'],
    }),
    /** POST /api/admin/ai-content — trigger AI content generation */
    generateAiContent: builder.mutation<ApiEnvelope<unknown>, { filePath?: string; model?: string; additionalContext?: string; overridePrompt?: string }>({
      query: (body) => ({
        url: 'admin/ai-content',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AiContent'],
    }),
    /** GET /api/admin/brand-config — read brand config */
    getAdminBrandConfig: builder.query<ApiEnvelope<unknown>, void>({
      query: () => 'admin/brand-config',
      providesTags: ['BrandConfig'],
    }),
    /** PUT /api/admin/brand-config — update brand config */
    updateAdminBrandConfig: builder.mutation<ApiEnvelope<unknown>, FormData | Record<string, unknown>>({
      query: (body) => ({
        url: 'admin/brand-config',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['BrandConfig'],
    }),
    /** GET /api/admin/navigation — list nav tree */
    getNavigation: builder.query<ApiEnvelope<unknown>, void>({
      query: () => 'admin/navigation',
      providesTags: ['Navigation'],
    }),
    /** POST /api/admin/navigation — create nav item */
    createNavigationItem: builder.mutation<ApiEnvelope<unknown>, Record<string, unknown>>({
      query: (body) => ({
        url: 'admin/navigation',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Navigation'],
    }),
    /** PUT /api/admin/navigation — batch update nav items */
    updateNavigationItems: builder.mutation<ApiEnvelope<unknown>, { items: Record<string, unknown>[] }>({
      query: (body) => ({
        url: 'admin/navigation',
        method: 'PUT',
        body,
      }),
      invalidatesTags: ['Navigation'],
    }),
    /** DELETE /api/admin/navigation — delete by IDs */
    deleteNavigationItems: builder.mutation<ApiEnvelope<unknown>, string[]>({
      query: (ids) => ({
        url: `admin/navigation?ids=${ids.map(encodeURIComponent).join(',')}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Navigation'],
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
  useClearSeedMutation,
  useGetAiContentQuery,
  useGenerateAiContentMutation,
  useGetAdminBrandConfigQuery,
  useUpdateAdminBrandConfigMutation,
  useGetNavigationQuery,
  useCreateNavigationItemMutation,
  useUpdateNavigationItemsMutation,
  useDeleteNavigationItemsMutation,
} = adminApi;
