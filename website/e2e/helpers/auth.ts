import type { Page } from '@playwright/test';
import { COOKIE_NAME, signSession } from '../../src/lib/auth/jwt';
export { E2E_GOOGLE_OAUTH, seedGoogleOAuthForE2E } from './google-oauth';

export async function setSessionTier(
  page: Page,
  tier: 'pin' | 'google',
): Promise<void> {
  const token = await signSession({
    sub: tier === 'pin' ? 'admin' : 'e2e-google-user',
    tier,
    name: tier === 'pin' ? 'Ops Admin' : 'E2E Google User',
    email: tier === 'google' ? 'e2e@redrubybali.com' : undefined,
  });

  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: token,
      domain: '127.0.0.1',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}
