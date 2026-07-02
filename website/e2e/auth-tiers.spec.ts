import { expect, test } from '@playwright/test';
import { setSessionTier } from './helpers/auth';

test.describe('public tier', () => {
  test('dashboard loads without session', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Business Review/ })).toBeVisible();
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
  });

  test('ops-admin shows sign-in gate', async ({ page }) => {
    await page.goto('/ops-admin');
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
    await expect(page.getByText('Ops Sign-In')).toBeVisible();
  });

  test('me API returns public tier', async ({ request }) => {
    const response = await request.get('/api/auth?action=me');
    const json = await response.json() as { data: { tier: string } };
    expect(json.data.tier).toBe('public');
  });
});

test.describe('pin tier', () => {
  test.beforeEach(async ({ page }) => {
    await setSessionTier(page, 'pin');
  });

  test('ops-admin is accessible', async ({ page }) => {
    await page.goto('/ops-admin');
    await expect(page.getByText('Daily POS, Costs, and Missing Days')).toBeVisible();
    await expect(page.getByTestId('sign-in-panel')).toHaveCount(0);
  });

  test('google-only summary is gated', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByTestId('sign-in-panel')).toBeVisible();
  });

  test('me API returns pin tier', async ({ page }) => {
    await page.goto('/dashboard');
    const json = await page.evaluate(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      return response.json() as Promise<{ data: { tier: string } }>;
    });
    expect(json.data.tier).toBe('pin');
  });
});

test.describe('google tier', () => {
  test.beforeEach(async ({ page }) => {
    await setSessionTier(page, 'google');
  });

  test('summary page is accessible', async ({ page }) => {
    await page.goto('/summary');
    await expect(page.getByTestId('sign-in-panel')).toHaveCount(0);
  });

  test('drawer shows sign out', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForFunction(async () => {
      const response = await fetch('/api/auth?action=me', { credentials: 'include' });
      const json = await response.json() as { data: { tier: string } };
      return json.data.tier === 'google';
    });
    await page.getByLabel('Open navigation').click();
    await expect(page.getByRole('link', { name: 'Sign out' })).toBeVisible();
  });

  test('ops-tracking shows reports rollup', async ({ page }) => {
    await page.goto('/ops-tracking');
    await expect(page.getByText('Z-Report Rollup')).toBeVisible();
  });

  test('google-config API returns public OAuth fields', async ({ request }) => {
    const response = await request.get('/api/auth?action=google-config');
    if (response.status() === 503) {
      test.skip();
      return;
    }
    const json = await response.json() as { success: boolean; data: { clientId: string; projectId: string; authUri: string } };
    expect(json.success).toBe(true);
    expect(json.data.clientId).toBeTruthy();
    expect(json.data.authUri).toContain('accounts.google.com');
    expect(json.data).not.toHaveProperty('clientSecret');
  });
});
