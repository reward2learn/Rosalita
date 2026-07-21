import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type { ChatAttachment } from '@/lib/chat/attachments';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
}

export const chatApi = createApi({
  reducerPath: 'chatApi',
  baseQuery,
  tagTypes: ['Conversations'],
  endpoints: (builder) => ({
    sendMessage: builder.mutation<
      ApiEnvelope<{ reply: string }>,
      { message: string; history?: ChatMessage[]; stream?: boolean }
    >({
      query: (body) => ({
        url: 'chat',
        method: 'POST',
        body,
      }),
    }),
    synthesizeVoice: builder.mutation<
      ApiEnvelope<{ audioChunks: string[]; format: string }>,
      { text: string; voice?: string; speed?: number }
    >({
      query: (body) => ({
        url: 'chat?resource=voice',
        method: 'POST',
        body,
      }),
    }),
    listConversations: builder.query<ApiEnvelope<unknown>, number | void>({
      query: (limit = 20) => ({
        url: 'chat',
        params: { resource: 'conversations', limit },
      }),
      providesTags: ['Conversations'],
    }),
    getConversation: builder.query<ApiEnvelope<unknown>, number>({
      query: (id) => ({
        url: 'chat',
        params: { resource: 'conversations', id },
      }),
      providesTags: (_result, _error, id) => [{ type: 'Conversations', id }],
    }),
    saveConversation: builder.mutation<
      ApiEnvelope<unknown>,
      { title?: string; messages: ChatMessage[] }
    >({
      query: (body) => ({
        url: 'chat?resource=conversations',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Conversations'],
    }),
    archiveConversation: builder.mutation<
      ApiEnvelope<{ id: number; archived: boolean }>,
      { id: number; archived?: boolean }
    >({
      query: ({ id, archived }) => ({
        url: `chat?resource=conversations&id=${id}${archived !== undefined ? `&archived=${archived}` : ''}`,
        method: 'PATCH',
      }),
      invalidatesTags: ['Conversations'],
    }),
  }),
});

export const {
  useSendMessageMutation,
  useSynthesizeVoiceMutation,
  useListConversationsQuery,
  useGetConversationQuery,
  useLazyGetConversationQuery,
  useSaveConversationMutation,
  useArchiveConversationMutation,
} = chatApi;
