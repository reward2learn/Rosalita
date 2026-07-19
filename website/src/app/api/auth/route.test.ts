import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { GET, POST } from './route';
import { COOKIE_NAME } from '@/lib/auth/jwt';

const TEST_KEY = 'a'.repeat(64);

vi.mock('@/lib/secrets', () => ({
  getSecretPlaintext: vi.fn(),
  setSecret: vi.fn(),
}));

vi.mock('@/lib/auth/google-oauth', () => ({
  getGoogleOAuthCredentials: vi.fn(),
  getGoogleOAuthPublicConfig: vi.fn(),
  buildGoogleAuthUrl: vi.fn(() => 'https://accounts.google.com/o/oauth2/auth?client_id=test'),
}));

vi.mock('@/domain/pdf/pdf-export-service', () => ({
  PdfExportService: vi.fn().mockImplementation(() => ({
    queueJob: vi.fn().mockResolvedValue('job-test-1'),
  })),
}));

vi.mock('@/lib/db', () => ({
  createClient: vi.fn(() => ({})),
}));

import { getSecretPlaintext, setSecret } from '@/lib/secrets';
import { getGoogleOAuthPublicConfig } from '@/lib/auth/google-oauth';
import * as session from '@/lib/auth/session';

describe('/api/auth', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete process.env.SETUP_TOKEN;
  });

  it('UC-AUTH-03: me returns public tier without cookie', async () => {
    const response = await GET(new Request('http://localhost/api/auth?action=me'));
    const json = await response.json() as { success: boolean; data: { tier: string; user: null } };
    expect(json.success).toBe(true);
    expect(json.data.tier).toBe('public');
    expect(json.data.user).toBeNull();
  });

  it('UC-AUTH-03: me returns session tier from cookie', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValue({
      sub: 'admin',
      tier: 'pin',
      name: 'Admin',
      authMethod: 'pin',
    });
    const response = await GET(new Request('http://localhost/api/auth?action=me'));
    const json = await response.json() as { data: { tier: string; user: { authMethod: string } } };
    expect(json.data.tier).toBe('pin');
    expect(json.data.user.authMethod).toBe('pin');
  });

  it('UC-AUTH-02: verify-pin sets session on correct PIN', async () => {
    vi.mocked(getSecretPlaintext).mockResolvedValue('secret-pin');
    const response = await POST(
      new Request('http://localhost/api/auth?action=verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', pin: 'secret-pin' }),
      }),
    );
    expect(response.status).toBe(200);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(COOKIE_NAME);
    const json = await response.json() as { ok: boolean };
    expect(json.ok).toBe(true);
  });

  it('UC-AUTH-02: verify-pin rejects incorrect PIN', async () => {
    vi.mocked(getSecretPlaintext).mockResolvedValue('secret-pin');
    const response = await POST(
      new Request('http://localhost/api/auth?action=verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'admin', pin: 'wrong' }),
      }),
    );
    const json = await response.json() as { ok: boolean; error: string };
    expect(json.ok).toBe(false);
    expect(json.error).toBe('Incorrect PIN');
  });

  it('UC-AUTH-08: store-key requires SETUP_TOKEN bearer', async () => {
    process.env.SETUP_TOKEN = 'setup-test-token';
    const response = await POST(
      new Request('http://localhost/api/auth?action=store-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ADMIN_PIN', value: '1234' }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it('UC-AUTH-08: store-key stores secret with valid bearer', async () => {
    process.env.SETUP_TOKEN = 'setup-test-token';
    vi.mocked(setSecret).mockResolvedValue(undefined);
    const response = await POST(
      new Request('http://localhost/api/auth?action=store-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer setup-test-token',
        },
        body: JSON.stringify({ key: 'ADMIN_PIN', value: '1234' }),
      }),
    );
    expect(response.status).toBe(200);
    const json = await response.json() as { success: boolean; key: string };
    expect(json.success).toBe(true);
    expect(json.key).toBe('ADMIN_PIN');
  });

  it('UC-AUTH-09: pdf requires google tier', async () => {
    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValueOnce({
      sub: 'admin',
      tier: 'pin',
      name: 'Admin',
      authMethod: 'pin',
    });
    const pinResponse = await GET(new Request('http://localhost/api/auth?action=pdf'));
    expect(pinResponse.status).toBe(401);

    vi.spyOn(session, 'getSessionFromRequest').mockResolvedValueOnce({
      sub: 'user-1',
      tier: 'google',
      name: 'Test User',
      email: 'test@example.com',
      authMethod: 'google',
    });
    const googleResponse = await GET(new Request('http://localhost/api/auth?action=pdf'));
    expect(googleResponse.status).toBe(202);
    const json = await googleResponse.json() as { success: boolean; data: { jobId: string } };
    expect(json.success).toBe(true);
    expect(json.data.jobId).toBe('job-test-1');
  });

  it('UC-AUTH-04: logout clears session cookie', async () => {
    const response = await GET(new Request('http://localhost/api/auth?action=logout'));
    expect(response.status).toBe(307);
    const setCookie = response.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
    expect(setCookie).toContain('Max-Age=0');
  });

  it('UC-AUTH-10: google-config returns public fields only', async () => {
    vi.mocked(getGoogleOAuthPublicConfig).mockResolvedValue({
      clientId: 'test-client-id',
      projectId: 'test-project',
      authUri: 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: 'https://oauth2.googleapis.com/token',
    });
    const response = await GET(new Request('http://localhost/api/auth?action=google-config'));
    expect(response.status).toBe(200);
    const json = await response.json() as { success: boolean; data: Record<string, string> };
    expect(json.success).toBe(true);
    expect(json.data.clientId).toBe('test-client-id');
    expect(json.data.projectId).toBe('test-project');
    expect(json.data.authUri).toBeDefined();
    expect(json.data).not.toHaveProperty('clientSecret');
  });

  it('UC-AUTH-10: google-config returns 503 when not configured', async () => {
    vi.mocked(getGoogleOAuthPublicConfig).mockResolvedValue(null);
    const response = await GET(new Request('http://localhost/api/auth?action=google-config'));
    expect(response.status).toBe(503);
  });
});
