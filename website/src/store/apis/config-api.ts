import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { ReseedResponse } from '@/app/api/config/reseed/route';
import type { ReprocessResponse } from '@/app/api/config/reprocess/route';

export interface OpenAiKeyStatus {
  configured: boolean;
  source: 'db' | 'env' | null;
}

export interface ChatSettings {
  webSearchEnabled: boolean;
  updatedAt: string;
}

export interface ReviewPartDetail {
  slug: string;
  title: string;
  partKey: string;
  markdownLength: number;
  markdownPreview: string;
}

export interface SeedDetailsResponse {
  appPages: unknown[];
  pageSections: unknown[];
  reviewPartDetails: ReviewPartDetail[];
  knowledgeSnippets: unknown[];
  tasks: unknown[];
  roles: unknown[];
  monthlyTargets: unknown[];
  levers: unknown[];
  actionItems: unknown[];
  dailyZReports: unknown[];
}

export const configApi = createApi({
  reducerPath: 'configApi',
  baseQuery,
  tagTypes: ['OpenAiKey', 'ChatSettings', 'SeedDetails'],
  endpoints: (builder) => ({
    reseedFromSources: builder.mutation<ApiEnvelope<ReseedResponse>, FormData>({
      query: (body) => ({
        url: 'config/reseed',
        method: 'POST',
        body,
      }),
    }),
    reprocessFromCache: builder.mutation<ApiEnvelope<ReprocessResponse>, void>({
      query: () => ({
        url: 'config/reprocess',
        method: 'POST',
      }),
    }),
    getOpenAiKeyStatus: builder.query<ApiEnvelope<OpenAiKeyStatus>, void>({
      query: () => 'config/openai-key',
      providesTags: ['OpenAiKey'],
    }),
    saveOpenAiKey: builder.mutation<ApiEnvelope<OpenAiKeyStatus>, { apiKey: string }>({
      query: (body) => ({
        url: 'config/openai-key',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['OpenAiKey'],
    }),
    clearOpenAiKey: builder.mutation<ApiEnvelope<OpenAiKeyStatus>, void>({
      query: () => ({
        url: 'config/openai-key',
        method: 'DELETE',
      }),
      invalidatesTags: ['OpenAiKey'],
    }),
    getChatSettings: builder.query<ApiEnvelope<ChatSettings>, void>({
      query: () => 'config/settings',
      providesTags: ['ChatSettings'],
    }),
    updateChatSettings: builder.mutation<ApiEnvelope<ChatSettings>, { webSearchEnabled: boolean }>({
      query: (body) => ({
        url: 'config/settings',
        method: 'PATCH',
        body,
      }),
      invalidatesTags: ['ChatSettings'],
    }),
    /** GET /api/config/seed-details — returns full seed inventory */
    getSeedDetails: builder.query<ApiEnvelope<SeedDetailsResponse>, void>({
      query: () => 'config/seed-details',
      providesTags: ['SeedDetails'],
    }),
    /** POST /api/config/import-data — bulk JSON import into seed tables */
    importData: builder.mutation<ApiEnvelope<{ imported: number }>, { table: string; data: unknown[] }>({
      query: (body) => ({
        url: 'config/import-data',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useReseedFromSourcesMutation,
  useReprocessFromCacheMutation,
  useGetOpenAiKeyStatusQuery,
  useSaveOpenAiKeyMutation,
  useClearOpenAiKeyMutation,
  useGetChatSettingsQuery,
  useUpdateChatSettingsMutation,
  useGetSeedDetailsQuery,
  useImportDataMutation,
} = configApi;
