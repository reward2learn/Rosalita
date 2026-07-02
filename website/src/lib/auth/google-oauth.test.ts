import { describe, expect, it, vi, beforeEach } from 'vitest';
import { encrypt } from '@/lib/crypto';

const mockFindUnique = vi.fn();
const mockUpsert = vi.fn();
const mockExecuteRawUnsafe = vi.fn();

vi.mock('@/lib/db', () => ({
  createClient: vi.fn(() => ({
    googleOAuthConfig: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
    $executeRawUnsafe: mockExecuteRawUnsafe,
  })),
}));

import {
  buildGoogleAuthUrl,
  getGoogleOAuthCredentials,
  getGoogleOAuthPublicConfig,
  setGoogleOAuthConfig,
} from '@/lib/auth/google-oauth';

const TEST_KEY = 'a'.repeat(64);

describe('google-oauth', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    vi.clearAllMocks();
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    delete process.env.GOOGLE_PROJECT_ID;
    delete process.env.GOOGLE_AUTH_URI;
  });

  it('loads and decrypts credentials from DB', async () => {
    const { encrypted, iv, authTag } = encrypt('secret-value');
    mockFindUnique.mockResolvedValue({
      clientId: 'client-1',
      projectId: 'proj-1',
      authUri: 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: 'https://oauth2.googleapis.com/token',
      encryptedSecret: encrypted,
      iv,
      authTag,
    });

    const creds = await getGoogleOAuthCredentials();
    expect(creds?.clientId).toBe('client-1');
    expect(creds?.projectId).toBe('proj-1');
    expect(creds?.clientSecret).toBe('secret-value');
  });

  it('falls back to env when DB row is missing', async () => {
    mockFindUnique.mockResolvedValue(null);
    process.env.GOOGLE_CLIENT_ID = 'env-client';
    process.env.GOOGLE_CLIENT_SECRET = 'env-secret';
    process.env.GOOGLE_PROJECT_ID = 'env-project';

    const creds = await getGoogleOAuthCredentials();
    expect(creds?.clientId).toBe('env-client');
    expect(creds?.clientSecret).toBe('env-secret');
    expect(creds?.projectId).toBe('env-project');
  });

  it('returns public config without client secret', async () => {
    const { encrypted, iv, authTag } = encrypt('secret');
    mockFindUnique.mockResolvedValue({
      clientId: 'client-1',
      projectId: 'proj-1',
      authUri: 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: 'https://oauth2.googleapis.com/token',
      encryptedSecret: encrypted,
      iv,
      authTag,
    });

    const config = await getGoogleOAuthPublicConfig();
    expect(config).toEqual({
      clientId: 'client-1',
      projectId: 'proj-1',
      authUri: 'https://accounts.google.com/o/oauth2/auth',
      tokenUri: 'https://oauth2.googleapis.com/token',
    });
    expect(config).not.toHaveProperty('clientSecret');
  });

  it('encrypts client secret on store', async () => {
    mockUpsert.mockResolvedValue({});
    await setGoogleOAuthConfig({
      clientId: 'client-1',
      projectId: 'proj-1',
      authUri: 'https://accounts.google.com/o/oauth2/auth',
      clientSecret: 'plain-secret',
    });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clientId: 'client-1',
          encryptedSecret: expect.any(String),
          iv: expect.any(String),
          authTag: expect.any(String),
        }),
      }),
    );
    const call = mockUpsert.mock.calls[0][0] as { create: { encryptedSecret: string } };
    expect(call.create.encryptedSecret).not.toBe('plain-secret');
  });

  it('buildGoogleAuthUrl uses authUri from config', () => {
    const url = buildGoogleAuthUrl(
      {
        clientId: 'cid',
        projectId: 'pid',
        authUri: 'https://accounts.google.com/o/oauth2/auth',
        tokenUri: 'https://oauth2.googleapis.com/token',
      },
      { redirectUri: 'http://localhost/callback', state: 's1' },
    );
    expect(url).toContain('client_id=cid');
    expect(url).toContain('redirect_uri=');
    expect(url.startsWith('https://accounts.google.com/o/oauth2/auth?')).toBe(true);
  });
});
