import { describe, expect, it } from 'vitest';
import {
  consumeSseStream,
  parseSseChunk,
  parseSsePayload,
  readOpenAiDelta,
} from './sse-parser';

describe('sse-parser', () => {
  it('parseSsePayload extracts delta content', () => {
    const events = parseSsePayload({ choices: [{ delta: { content: 'Hello' } }] });
    expect(events).toEqual([{ type: 'token', token: 'Hello' }]);
  });

  it('parseSsePayload extracts message content fallback', () => {
    const events = parseSsePayload({ choices: [{ message: { content: 'Full reply' } }] });
    expect(events).toEqual([{ type: 'token', token: 'Full reply' }]);
  });

  it('parseSsePayload surfaces stream errors', () => {
    const events = parseSsePayload({ error: 'rate limited' });
    expect(events).toEqual([{ type: 'error', error: 'rate limited' }]);
  });

  it('readOpenAiDelta throws on error field', () => {
    expect(() => readOpenAiDelta({ error: 'rate limited' })).toThrow('rate limited');
  });

  it('parseSseChunk accumulates tokens across lines', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"Hi"}}]}\n\ndata: [DONE]\n';
    const { events, remainder } = parseSseChunk(chunk);
    expect(events).toEqual([
      { type: 'token', token: 'Hi' },
      { type: 'done' },
    ]);
    expect(remainder).toBe('');
  });

  it('parseSseChunk extracts chat session actions', () => {
    const chunk = 'data: {"type":"chat_action","action":"save_conversation"}\n\ndata: {"choices":[{"delta":{"content":"Done"}}]}\n';
    const { events, remainder } = parseSseChunk(chunk);
    expect(events).toEqual([
      { type: 'action', action: 'save_conversation' },
      { type: 'token', token: 'Done' },
    ]);
    expect(remainder).toBe('');
  });

  it('parseSseChunk preserves partial line in remainder', () => {
    const chunk = 'data: {"choices":[{"delta":{"content":"A"}}]}\ndata: {"cho';
    const { events, remainder } = parseSseChunk(chunk);
    expect(events).toEqual([{ type: 'token', token: 'A' }]);
    expect(remainder).toBe('data: {"cho');
  });

  it('consumeSseStream emits events for every chunk and flushes at end', async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel'));
        controller.enqueue(encoder.encode('lo"}}]}\n\ndata: {"error":"boom"}\n\ndata: [DONE]\n'));
        controller.close();
      },
    });

    const events: string[] = [];
    await consumeSseStream(body, (event) => {
      events.push(`${event.type}:${'token' in event ? event.token : 'error' in event ? event.error : ''}`);
    });

    expect(events).toEqual(['token:Hello', 'error:boom', 'done:']);
  });
});
