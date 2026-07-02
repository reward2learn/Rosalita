import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { ReseedResponse } from '@/app/api/config/reseed/route';

export interface OpenAiKeyStatus {
  configured: boolean;
  source: 'db' | 'env' | null;
}

export interface ChatSettings {
  webSearchEnabled: boolean;
  updatedAt: string;
}

export const configApi = createApi({
  reducerPath: 'configApi',
  baseQuery,
  tagTypes: ['OpenAiKey', 'ChatSettings'],
  endpoints: (builder) => ({
    reseedFromSources: builder.mutation<ApiEnvelope<ReseedResponse>, FormData>({
      query: (body) => ({
        url: 'config/reseed',
        method: 'POST',
        body,
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
  }),
});

export const {
  useReseedFromSourcesMutation,
  useGetOpenAiKeyStatusQuery,
  useSaveOpenAiKeyMutation,
  useClearOpenAiKeyMutation,
  useGetChatSettingsQuery,
  useUpdateChatSettingsMutation,
} = configApi;
