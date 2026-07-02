import { describe, expect, it } from 'vitest';
import { sanitizeConversationMessages } from './conversation-messages';

describe('sanitizeConversationMessages', () => {
  it('strips NUL bytes from content', () => {
    const result = sanitizeConversationMessages([
      { role: 'user', content: 'before\u0000after' },
      { role: 'assistant', content: 'ok' },
    ]);
    expect(result[0].content).toBe('beforeafter');
    expect(result[1].content).toBe('ok');
  });

  it('preserves newlines, quotes, and emoji', () => {
    const text = 'line1\n"quoted" \\backslash 🌮';
    const result = sanitizeConversationMessages([{ role: 'user', content: text }]);
    expect(result[0].content).toBe(text);
  });

  it('preserves image attachment metadata and base64 data', () => {
    const result = sanitizeConversationMessages([{
      role: 'user',
      content: 'look at this',
      attachments: [{
        name: 'chart.png',
        mimeType: 'image/png',
        size: 1234,
        kind: 'image',
        dataBase64: 'aGVsbG8=',
      }],
    }]);
    expect(result[0].attachments?.[0]?.dataBase64).toBe('aGVsbG8=');
    expect(result[0].attachments?.[0]?.kind).toBe('image');
  });

  it('drops oversized base64 payloads and flags truncation', () => {
    const huge = 'A'.repeat(6 * 1024 * 1024);
    const result = sanitizeConversationMessages([{
      role: 'user',
      content: 'big file',
      attachments: [{
        name: 'huge.png',
        mimeType: 'image/png',
        size: 5 * 1024 * 1024,
        kind: 'image',
        dataBase64: huge,
      }],
    }]);
    expect(result[0].attachments?.[0]?.dataBase64).toBeUndefined();
    expect(result[0].attachments?.[0]?.truncated).toBe(true);
  });
});
