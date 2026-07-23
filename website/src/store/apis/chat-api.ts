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
  tagTypes: ['Conversations', 'AiFindings'],
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
    /** GET /api/chat/ai-findings — list AI findings */
    getAiFindings: builder.query<ApiEnvelope<unknown[]>, void>({
      query: () => 'chat/ai-findings',
      providesTags: ['AiFindings'],
    }),
    /** POST /api/chat/ai-findings — create AI finding */
    createAiFinding: builder.mutation<ApiEnvelope<unknown>, { content: string; title?: string }>({
      query: (body) => ({
        url: 'chat/ai-findings',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AiFindings'],
    }),
    /** DELETE /api/chat/ai-findings — delete by IDs */
    deleteAiFindings: builder.mutation<ApiEnvelope<void>, string[]>({
      query: (ids) => ({
        url: `chat/ai-findings?ids=${ids.map(encodeURIComponent).join(',')}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AiFindings'],
    }),
    /** POST /api/chat/ai-findings/save-batch — replace all findings */
    saveAiFindingsBatch: builder.mutation<ApiEnvelope<void>, { findings: unknown[] }>({
      query: (body) => ({
        url: 'chat/ai-findings/save-batch',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['AiFindings'],
    }),
    /** POST /api/chat/summarize-finding — summarize a finding */
    summarizeFinding: builder.mutation<ApiEnvelope<{ summary: string }>, { content: string }>({
      query: (body) => ({
        url: 'chat/summarize-finding',
        method: 'POST',
        body,
      }),
    }),
    /** POST /api/chat/update-review — update review content via AI */
    updateReview: builder.mutation<ApiEnvelope<unknown>, { messages: ChatMessage[]; summary: string; target?: string }>({
      query: (body) => ({
        url: 'chat/update-review',
        method: 'POST',
        body,
      }),
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
  useGetAiFindingsQuery,
  useCreateAiFindingMutation,
  useDeleteAiFindingsMutation,
  useSaveAiFindingsBatchMutation,
  useSummarizeFindingMutation,
  useUpdateReviewMutation,
} = chatApi;
