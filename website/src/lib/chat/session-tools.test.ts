import { describe, expect, it } from 'vitest';
import { isExplicitSessionRequest } from '@/lib/chat/session-tools';

describe('session-tools', () => {
  it('does not treat revenue questions as session requests', () => {
    expect(isExplicitSessionRequest('hello can you report on the revenue please')).toBe(false);
  });

  it('detects explicit new chat requests', () => {
    expect(isExplicitSessionRequest('start a new chat please')).toBe(true);
  });

  it('detects explicit save conversation requests', () => {
    expect(isExplicitSessionRequest('save this conversation')).toBe(true);
  });
});
