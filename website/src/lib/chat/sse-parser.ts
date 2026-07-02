export type SseStreamEvent =
  | { type: 'token'; token: string }
  | { type: 'action'; action: string }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface ParsedSseChunk {
  events: SseStreamEvent[];
  remainder: string;
}

function streamErrorMessage(error: unknown): string {
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message.trim();
  }
  return 'The AI service returned an error.';
}

/** Parse one SSE JSON payload into stream events. */
export function parseSsePayload(payload: unknown): SseStreamEvent[] {
  const data = payload as {
    type?: string;
    action?: string;
    error?: string | { message?: string };
    choices?: { delta?: { content?: string }; message?: { content?: string } }[];
  };

  if (data.type === 'chat_action' && typeof data.action === 'string') {
    return [{ type: 'action', action: data.action }];
  }

  if (data.error) {
    return [{ type: 'error', error: streamErrorMessage(data.error) }];
  }

  const token = data.choices?.[0]?.delta?.content ?? data.choices?.[0]?.message?.content ?? '';
  if (token) {
    return [{ type: 'token', token }];
  }

  return [];
}

/** @deprecated Use parseSsePayload — kept for older tests/callers. */
export function readOpenAiDelta(payload: unknown): string {
  const events = parseSsePayload(payload);
  const error = events.find((event) => event.type === 'error');
  if (error?.type === 'error') throw new Error(error.error);
  const token = events.find((event) => event.type === 'token');
  return token?.type === 'token' ? token.token : '';
}

/** @deprecated Use parseSsePayload */
export function readChatSessionAction(payload: unknown): string | null {
  const events = parseSsePayload(payload);
  const action = events.find((event) => event.type === 'action');
  return action?.type === 'action' ? action.action : null;
}

function parseSseLine(line: string): SseStreamEvent[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith('data:')) return [];
  const raw = trimmed.slice('data:'.length).trim();
  if (!raw || raw === '[DONE]') return [{ type: 'done' }];
  try {
    return parseSsePayload(JSON.parse(raw) as unknown);
  } catch {
    return [{ type: 'error', error: 'Received malformed stream data from the AI service.' }];
  }
}

/**
 * Parse SSE `data:` lines from a buffered chunk.
 * Returns stream events and the remaining partial line buffer.
 */
export function parseSseChunk(buffer: string): ParsedSseChunk {
  const lines = buffer.split('\n');
  const remainder = lines.pop() ?? '';
  const events: SseStreamEvent[] = [];

  for (const line of lines) {
    events.push(...parseSseLine(line));
  }

  return { events, remainder };
}

/**
 * Listen to an SSE response body and emit parsed stream events for every chunk.
 * Flushes any trailing partial line when the stream closes.
 */
export async function consumeSseStream(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: SseStreamEvent) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const flushBuffer = (final = false) => {
    if (final && buffer.trim()) {
      buffer += '\n';
    }
    const { events, remainder } = parseSseChunk(buffer);
    buffer = remainder;
    for (const event of events) {
      onEvent(event);
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      buffer += decoder.decode();
      flushBuffer(true);
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    flushBuffer(false);
  }
}
