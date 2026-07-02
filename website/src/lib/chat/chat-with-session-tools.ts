import {
  CHAT_SESSION_OPENAI_TOOLS,
  type ChatSessionAction,
  executeSessionTool,
  type SessionToolContext,
} from '@/lib/chat/session-tools';

export const CHAT_WEB_SEARCH_INSTRUCTIONS = `Web search is enabled on this chat model. When the user asks about current events, live market data, recent news, or information that may have changed after your training data, search the web before answering. Cite sources briefly when web results are used.`;

function buildOpenAiTools(webSearchEnabled: boolean, sessionToolsEnabled: boolean) {
  if (webSearchEnabled || !sessionToolsEnabled) return undefined;
  return [...CHAT_SESSION_OPENAI_TOOLS];
}

function isSessionFunctionToolCall(toolCall: OpenAiToolCall): boolean {
  return CHAT_SESSION_OPENAI_TOOLS.some((tool) => tool.function.name === toolCall.function.name);
}

interface OpenAiToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAiChatMessage {
  role: string;
  content?: string | null | Array<{ type: string; text?: string; image_url?: { url: string } }>;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiCompletionResponse {
  choices?: {
    finish_reason?: string;
    message?: OpenAiChatMessage;
  }[];
}

interface OpenAiStreamDelta {
  error?: { message?: string };
  choices?: {
    finish_reason?: string | null;
    delta?: {
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        type?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
  }[];
}

interface ConsumedOpenAiStream {
  finishReason: string | null;
  content: string;
  toolCalls: OpenAiToolCall[];
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const;

const MAX_TOOL_ROUNDS = 4;

function openAiErrorMessage(status: number, detail?: string): string {
  if (detail?.trim()) return detail.trim();
  if (status === 401) return 'The OpenAI API key appears to be invalid.';
  if (status === 429) return 'The AI service is currently rate-limited.';
  return 'The AI service returned an error.';
}

async function readOpenAiError(response: Response): Promise<string> {
  try {
    const data = await response.json() as { error?: string | { message?: string } };
    if (typeof data.error === 'string' && data.error.trim()) return data.error.trim();
    if (data.error && typeof data.error === 'object' && data.error.message?.trim()) {
      return data.error.message.trim();
    }
  } catch {
    // ignore parse errors
  }
  return openAiErrorMessage(response.status);
}

function encodeSseLine(payload: unknown): string {
  return `data: ${JSON.stringify(payload)}\n\n`;
}

function errorStream(message: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(encodeSseLine({ error: message })));
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}

async function requestOpenAiCompletion(
  apiKey: string,
  model: string,
  messages: OpenAiChatMessage[],
  stream: boolean,
  webSearchEnabled: boolean,
  sessionToolsEnabled: boolean,
): Promise<Response> {
  const tools = buildOpenAiTools(webSearchEnabled, sessionToolsEnabled);
  const body = {
    model,
    messages,
    ...(tools ? { tools, tool_choice: 'auto' as const } : {}),
    max_tokens: 1200,
    ...(webSearchEnabled ? {} : { temperature: 0.7 }),
    stream,
  };

  return fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });
}

export async function consumeOpenAiStream(
  body: ReadableStream<Uint8Array>,
  onContent?: (chunk: string) => void | Promise<void>,
): Promise<ConsumedOpenAiStream> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const toolCallsByIndex = new Map<number, OpenAiToolCall>();
  let finishReason: string | null = null;
  let content = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      break;
    }
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith('data:')) continue;
      const raw = trimmed.slice('data:'.length).trim();
      if (!raw || raw === '[DONE]') continue;

      const parsed = JSON.parse(raw) as OpenAiStreamDelta & { error?: string | { message?: string } };
      if (typeof parsed.error === 'string' && parsed.error.trim()) {
        throw new Error(parsed.error.trim());
      }
      if (parsed.error && typeof parsed.error === 'object' && parsed.error.message) {
        throw new Error(parsed.error.message);
      }

      const choice = parsed.choices?.[0];
      if (!choice) continue;

      if (choice.finish_reason) {
        finishReason = choice.finish_reason;
      }

      const delta = choice.delta;
      if (delta?.content) {
        content += delta.content;
        await onContent?.(delta.content);
      }

      if (delta?.tool_calls) {
        for (const toolDelta of delta.tool_calls) {
          const index = toolDelta.index ?? 0;
          let existing = toolCallsByIndex.get(index);
          if (!existing) {
            existing = {
              id: toolDelta.id ?? '',
              type: 'function',
              function: {
                name: toolDelta.function?.name ?? '',
                arguments: toolDelta.function?.arguments ?? '',
              },
            };
            toolCallsByIndex.set(index, existing);
          }
          if (toolDelta.id) existing.id = toolDelta.id;
          if (toolDelta.function?.name) existing.function.name = toolDelta.function.name;
          if (toolDelta.function?.arguments) {
            existing.function.arguments += toolDelta.function.arguments;
          }
        }
      }
    }
  }

  if (buffer.trim()) {
    const trimmed = buffer.trim();
    if (trimmed.startsWith('data:')) {
      const raw = trimmed.slice('data:'.length).trim();
      if (raw && raw !== '[DONE]') {
        const parsed = JSON.parse(raw) as OpenAiStreamDelta & { error?: string | { message?: string } };
        const choice = parsed.choices?.[0];
        if (choice?.delta?.content) {
          content += choice.delta.content;
          await onContent?.(choice.delta.content);
        }
        if (choice?.finish_reason) {
          finishReason = choice.finish_reason;
        }
      }
    }
  }

  const toolCalls = Array.from(toolCallsByIndex.entries())
    .sort(([left], [right]) => left - right)
    .map(([, call]) => call)
    .filter((call) => call.id && call.function.name);

  return { finishReason, content, toolCalls };
}

async function completeChatWithoutStreaming(options: {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  toolContext: SessionToolContext;
  webSearchEnabled: boolean;
  sessionToolsEnabled: boolean;
}): Promise<Response> {
  const clientActions: ChatSessionAction[] = [];
  let currentMessages = [...options.messages];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
    const chatResp = await requestOpenAiCompletion(
      options.apiKey,
      options.model,
      currentMessages,
      false,
      options.webSearchEnabled,
      options.sessionToolsEnabled,
    );

    if (!chatResp.ok) {
      const errReply = await readOpenAiError(chatResp);
      return Response.json({ success: true, data: { reply: errReply, actions: clientActions } });
    }

    const data = await chatResp.json() as OpenAiCompletionResponse;
    const message = data.choices?.[0]?.message;
    if (!message) {
      const fallback = 'I could not generate a response. Please try again.';
      return Response.json({ success: true, data: { reply: fallback, actions: clientActions } });
    }

    if (message.tool_calls?.length) {
      const sessionToolCalls = message.tool_calls.filter(isSessionFunctionToolCall);
      if (sessionToolCalls.length) {
        currentMessages.push(message);
        for (const toolCall of sessionToolCalls) {
          const result = await executeSessionTool(
            toolCall.function.name,
            toolCall.function.arguments,
            options.toolContext,
          );
          if (result.clientAction) clientActions.push(result.clientAction);
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: result.toolMessage,
          });
        }
        continue;
      }
    }

    const replyContent = typeof message.content === 'string' ? message.content : '';
    const reply = replyContent.trim()
      || 'I could not generate a response. Please try rephrasing your question.';

    return Response.json({
      success: true,
      data: {
        reply,
        actions: clientActions,
      },
    });
  }

  const fallback = 'I could not complete the requested session action. Please try again.';
  return Response.json({ success: true, data: { reply: fallback, actions: clientActions } });
}

async function completeChatWithStreaming(options: {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  toolContext: SessionToolContext;
  webSearchEnabled: boolean;
  sessionToolsEnabled: boolean;
}): Promise<Response> {
  const encoder = new TextEncoder();
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();

  const writeLine = async (payload: unknown) => {
    await writer.write(encoder.encode(encodeSseLine(payload)));
  };

  void (async () => {
    let currentMessages = [...options.messages];
    let streamedChars = 0;
    let emittedError = false;

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
        const chatResp = await requestOpenAiCompletion(
          options.apiKey,
          options.model,
          currentMessages,
          true,
          options.webSearchEnabled,
          options.sessionToolsEnabled,
        );

        if (!chatResp.ok || !chatResp.body) {
          const errMessage = chatResp.ok
            ? 'The AI service returned an empty stream.'
            : await readOpenAiError(chatResp);
          await writeLine({ error: errMessage });
          emittedError = true;
          break;
        }

        const { finishReason, content, toolCalls } = await consumeOpenAiStream(
          chatResp.body,
          async (chunk) => {
            streamedChars += chunk.length;
            await writeLine({ choices: [{ delta: { content: chunk } }] });
          },
        );

        if (finishReason === 'tool_calls' && toolCalls.length) {
          const sessionToolCalls = toolCalls.filter(isSessionFunctionToolCall);
          if (sessionToolCalls.length) {
            currentMessages.push({
              role: 'assistant',
              content: content || null,
              tool_calls: sessionToolCalls,
            });

            for (const toolCall of sessionToolCalls) {
              const result = await executeSessionTool(
                toolCall.function.name,
                toolCall.function.arguments,
                options.toolContext,
              );
              if (result.clientAction) {
                await writeLine({ type: 'chat_action', action: result.clientAction });
              }
              currentMessages.push({
                role: 'tool',
                tool_call_id: toolCall.id,
                content: result.toolMessage,
              });
            }
            continue;
          }
        }

        break;
      }

      if (streamedChars === 0 && !emittedError) {
        await writeLine({
          error: 'The assistant returned an empty response. Please try again.',
        });
      }

      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Chat stream failed';
      await writeLine({ error: message });
      await writer.write(encoder.encode('data: [DONE]\n\n'));
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { headers: SSE_HEADERS });
}

export async function completeChatWithSessionTools(options: {
  apiKey: string;
  model: string;
  messages: OpenAiChatMessage[];
  toolContext: SessionToolContext;
  stream: boolean;
  webSearchEnabled: boolean;
  sessionToolsEnabled: boolean;
}): Promise<Response> {
  if (options.stream) {
    return completeChatWithStreaming(options);
  }
  return completeChatWithoutStreaming(options);
}
