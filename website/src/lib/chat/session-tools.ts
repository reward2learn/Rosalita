import type { DbClient } from '@/lib/db';
import { sanitizeConversationMessages, type ConversationMessageInput } from '@/lib/chat/conversation-messages';

export type ChatSessionAction =
  | 'new_chat_session'
  | 'clear_conversation'
  | 'close_conversation'
  | 'save_conversation'
  | 'update_review_documents';

export const CHAT_SESSION_ACTIONS: ChatSessionAction[] = [
  'new_chat_session',
  'clear_conversation',
  'close_conversation',
  'save_conversation',
  'update_review_documents',
];

export function isChatSessionAction(value: unknown): value is ChatSessionAction {
  return typeof value === 'string' && (CHAT_SESSION_ACTIONS as readonly string[]).includes(value);
}

export function isClientClearSessionAction(action: ChatSessionAction): boolean {
  return action === 'new_chat_session'
    || action === 'clear_conversation'
    || action === 'close_conversation';
}

const EXPLICIT_SESSION_REQUEST_PATTERN = /\b(new chat|fresh chat|start over|start fresh|clear(?: the)?(?: chat| conversation)|close(?: the)? conversation|save(?: this)?(?: chat| conversation)|save conversation|update(?: the)?(?: review|documents?|business review)|save to review|update review)\b/i;

/** Only attach session tools when the user is clearly asking to manage the chat UI. */
export function isExplicitSessionRequest(message: string): boolean {
  return EXPLICIT_SESSION_REQUEST_PATTERN.test(message.trim());
}

export const CHAT_SESSION_TOOL_INSTRUCTIONS = `You can manage the active chat session with tools that mirror the chat UI buttons.
Only call a session tool when the user explicitly asks to start a new chat, clear the chat, close the conversation, or save the conversation.
Never call session tools for business questions, metrics, revenue, operations, or general knowledge requests.
When a session tool is appropriate, call the matching tool before confirming the action in your reply.

To update the Business Review and Executive Summary with insights from your conversation:
- When the user says something like "update the review" or "save this to the review" or provides substantive new financial/operational information, call the "update_review_documents" tool.
- Include a brief summary of the key changes or new information to incorporate.`;

export const CHAT_SESSION_OPENAI_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'new_chat_session',
      description: 'Start a fresh chat session and clear the current conversation from the UI.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'clear_conversation',
      description: 'Clear all messages in the current chat without saving.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'close_conversation',
      description: 'Close the current conversation session and clear the chat.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'save_conversation',
      description: 'Save the current conversation to saved conversations.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Optional short title for the saved conversation',
          },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'update_review_documents',
      description: 'Update the Business Review and Executive Summary documents with insights, corrections, or new information from the current conversation.',
      parameters: {
        type: 'object',
        properties: {
          summary: {
            type: 'string',
            description: 'Brief summary of the key updates, new data, or corrections to incorporate into the Business Review and Executive Summary.',
          },
        },
        required: ['summary'],
        additionalProperties: false,
      },
    },
  },
];

export interface SessionToolContext {
  db: DbClient;
  userName: string;
  messages: ConversationMessageInput[];
}

export interface SessionToolResult {
  toolMessage: string;
  clientAction?: ChatSessionAction;
}

export async function executeSessionTool(
  toolName: string,
  rawArgs: string,
  ctx: SessionToolContext,
): Promise<SessionToolResult> {
  let args: Record<string, unknown> = {};
  if (rawArgs.trim()) {
    try {
      args = JSON.parse(rawArgs) as Record<string, unknown>;
    } catch {
      return { toolMessage: 'Tool arguments were invalid JSON.' };
    }
  }

  switch (toolName) {
    case 'new_chat_session':
      return {
        toolMessage: 'Started a new chat session.',
        clientAction: 'new_chat_session',
      };
    case 'clear_conversation':
      return {
        toolMessage: 'Cleared the current conversation.',
        clientAction: 'clear_conversation',
      };
    case 'close_conversation':
      return {
        toolMessage: 'Closed the current conversation.',
        clientAction: 'close_conversation',
      };
    case 'save_conversation': {
      if (!ctx.messages.length) {
        return { toolMessage: 'There is nothing to save yet.' };
      }

      const messages = sanitizeConversationMessages(ctx.messages);
      const firstUser = messages.find((msg) => msg.role === 'user')?.content ?? 'Chat Conversation';
      const title = typeof args.title === 'string' && args.title.trim()
        ? args.title.trim().slice(0, 200)
        : firstUser.slice(0, 80);

      const saved = await ctx.db.conversation.create({
        data: {
          userName: ctx.userName,
          title,
          messages: messages as object[],
          messageCount: messages.length,
        },
      });

      return {
        toolMessage: `Conversation saved (id ${saved.id}).`,
        clientAction: 'save_conversation',
      };
    }
    case 'update_review_documents': {
      const summary = typeof args.summary === 'string' ? args.summary.trim() : '';
      if (!summary) {
        return { toolMessage: 'Please provide a summary of what to update in the review.' };
      }

      try {
        const res = await fetch('/api/chat/update-review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: ctx.messages, summary }),
        });
        const payload = await res.json();
        if (payload.success) {
          return {
            toolMessage: `✅ Business Review and Executive Summary updated based on our conversation. ${payload.data.partsUpdated} review part(s) updated.`,
            clientAction: 'update_review_documents',
          };
        }
        return { toolMessage: `Failed to update: ${payload.error ?? 'Unknown error'}` };
      } catch (err) {
        return { toolMessage: `Error updating review: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    default:
      return { toolMessage: `Unknown session tool: ${toolName}` };
  }
}
