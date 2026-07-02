/**
 * Chat Completions models that support SSE text streaming.
 * gpt-realtime-* models use the Realtime WebSocket API and do not stream text
 * through /v1/chat/completions.
 */
export function resolveChatCompletionModel(webSearchEnabled = false): string {
  if (webSearchEnabled) {
    const searchModel = process.env.OPENAI_WEB_SEARCH_MODEL || 'gpt-4o-mini-search-preview';
    if (!/realtime/i.test(searchModel)) return searchModel;
    return 'gpt-4o-mini-search-preview';
  }

  const configured = process.env.OPENAI_CHAT_MODEL
    || process.env.OPENAI_MODEL
    || 'gpt-4o-mini';

  if (/realtime/i.test(configured)) {
    return process.env.OPENAI_CHAT_STREAM_MODEL || 'gpt-4o-mini';
  }

  return configured;
}
