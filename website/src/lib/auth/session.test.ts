import { describe, expect, it, afterEach } from 'vitest';
import { buildSessionCookie, buildClearSessionCookie } from './session';
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
