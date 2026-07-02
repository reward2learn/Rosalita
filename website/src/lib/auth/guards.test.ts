import { describe, expect, it, vi, beforeEach } from 'vitest';
import { requireWriteAuth, requireGoogle, requireSession } from './guards';
import * as session from '@/lib/auth/session';

describe('auth guards', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('requireSession returns 401 without cookie', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue(null);
    const result = await requireSession(new Request('http://localhost/api/metrics'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('requireWriteAuth accepts pin tier', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue({
      sub: 'admin',
      tier: 'pin',
      name: 'Admin',
      authMethod: 'pin',
    });
    const result = await requireWriteAuth(new Request('http://localhost/api/metrics'));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.session.tier).toBe('pin');
  });

  it('requireWriteAuth accepts google tier', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue({
      sub: 'user-1',
      tier: 'google',
      name: 'User',
      email: 'u@example.com',
      authMethod: 'google',
    });
    const result = await requireWriteAuth(new Request('http://localhost/api/metrics'));
    expect(result.ok).toBe(true);
  });

  it('requireWriteAuth rejects missing session', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue(null);
    const result = await requireWriteAuth(new Request('http://localhost/api/metrics'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });

  it('requireGoogle rejects pin tier', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue({
      sub: 'admin',
      tier: 'pin',
      name: 'Admin',
      authMethod: 'pin',
    });
    const result = await requireGoogle(new Request('http://localhost/api/auth?action=pdf'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(401);
  });
});
