import { afterEach, describe, expect, it } from 'vitest';
import { resolveChatCompletionModel } from '@/lib/chat/chat-model';

describe('resolveChatCompletionModel', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('uses search preview model when web search is enabled', () => {
    delete process.env.OPENAI_WEB_SEARCH_MODEL;
    expect(resolveChatCompletionModel(true)).toBe('gpt-4o-mini-search-preview');
  });

  it('uses configured chat model when web search is disabled', () => {
    process.env.OPENAI_CHAT_MODEL = 'gpt-4o-mini';
    expect(resolveChatCompletionModel(false)).toBe('gpt-4o-mini');
  });
});
