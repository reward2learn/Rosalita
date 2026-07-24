import { describe, expect, it, afterEach } from 'vitest';
import { buildSessionCookie, buildClearSessionCookie, getSessionFromRequest } from './session';
import { COOKIE_NAME } from './jwt';

describe('session cookies', () => {
  afterEach(() => {
    delete process.env.VERCEL_ENV;
  });

  it('buildSessionCookie sets HttpOnly and SameSite=Lax', () => {
    const cookie = buildSessionCookie('token-123');
    expect(cookie).toContain(`${COOKIE_NAME}=token-123`);
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Lax');
    expect(cookie).toContain('Path=/');
  });

  it('buildSessionCookie adds Secure in production', () => {
    process.env.VERCEL_ENV = 'production';
    const cookie = buildSessionCookie('token-123');
    expect(cookie).toContain('Secure');
  });

  it('buildSessionCookie omits Secure outside production', () => {
    process.env.VERCEL_ENV = 'preview';
    const cookie = buildSessionCookie('token-123');
    expect(cookie).not.toContain('Secure');
  });

  it('buildClearSessionCookie expires session', () => {
    const cookie = buildClearSessionCookie();
    expect(cookie).toContain(`${COOKIE_NAME}=`);
    expect(cookie).toContain('Max-Age=0');
    expect(cookie).toContain('HttpOnly');
  });
});

describe('getSessionFromRequest', () => {
  it('uses fast path when X-Session-Verified header present', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: {
        'X-Session-Verified': '1',
        'X-Session-Sub': 'test-sub',
        'X-Session-Tier': 'pin',
        'X-Session-Groups': '[]',
        'X-Session-Permissions': '[]',
        'X-Session-PlatformAdmin': '0',
      },
    });
    const session = await getSessionFromRequest(request);
    expect(session).toBeTruthy();
    expect(session!.sub).toBe('test-sub');
    expect(session!.tier).toBe('pin');
  });

  it('falls back to cookie parsing when X-Session-Verified header absent', async () => {
    const request = new Request('http://localhost/api/test', {
      headers: {},
    });
    const session = await getSessionFromRequest(request);
    expect(session).toBeNull();
  });
});
