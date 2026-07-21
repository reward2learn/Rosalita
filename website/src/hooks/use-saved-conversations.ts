'use client';

import { useMemo } from 'react';
import {
  useLazyGetConversationQuery,
  useListConversationsQuery,
} from '@/store/apis/chat-api';
import { useAppDispatch } from '@/store/hooks';
import { setMessages, type ChatStreamMessage } from '@/store/chat-stream-slice';
import { isChatAttachment } from '@/lib/chat/attachments';

interface ConversationSummary {
  id: number;
  title?: string;
  message_count?: number;
  created_at?: string;
  archived?: boolean;
  owner_sub?: string | null;
}

function isConversationSummary(value: unknown): value is ConversationSummary {
  return typeof value === 'object'
    && value !== null
    && typeof (value as { id?: unknown }).id === 'number';
}

function normalizeLoadedMessages(value: unknown): ChatStreamMessage[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((msg) => {
    const row = msg as { role?: unknown; content?: unknown; attachments?: unknown };
    if ((row.role === 'user' || row.role === 'assistant') && typeof row.content === 'string') {
      const attachments = Array.isArray(row.attachments)
        ? row.attachments.filter(isChatAttachment)
        : [];
      return [{
        role: row.role,
        content: row.content,
        ...(attachments.length ? { attachments } : {}),
      }];
    }
    return [];
  });
}

export function useSavedConversations() {
  const dispatch = useAppDispatch();
  const { data: conversationsPayload, isFetching: conversationsLoading } = useListConversationsQuery(20);
  const [loadConversation, { isFetching: isLoadingConversation }] = useLazyGetConversationQuery();

  const conversations = useMemo(() => {
    const data = conversationsPayload?.data;
    return Array.isArray(data) ? data.filter(isConversationSummary) : [];
  }, [conversationsPayload]);

  const load = async (id: number): Promise<boolean> => {
    const payload = await loadConversation(id).unwrap();
    const data = payload.data as { messages?: unknown } | undefined;
    dispatch(setMessages(normalizeLoadedMessages(data?.messages)));
    return true;
  };

  return {
    conversations,
    conversationsLoading,
    isLoadingConversation,
    load,
  };
}
