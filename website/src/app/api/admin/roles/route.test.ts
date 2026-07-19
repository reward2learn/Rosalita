import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GET, POST } from './route';

const TEST_KEY = 'a'.repeat(64);

vi.mock('@/lib/db', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/auth/guards', () => ({
  requireSession: vi.fn(),
  requireWriteAuth: vi.fn(),
  requireGoogle: vi.fn(),
  requireRole: vi.fn(),
}));

vi.mock('@/lib/secrets', () => ({
  getSecretPlaintext: vi.fn(),
  setSecret: vi.fn(),
}));

import { createClient } from '@/lib/db';
import { getSecretPlaintext, setSecret } from '@/lib/secrets';

function makeDb() {
  const roles = [
    { id: 'r-ama', code: 'ama', name: 'Ama', email: 'ama@redruby.com', isPlatformAdmin: false },
    { id: 'r-admin', code: 'admin', name: 'Platform Admin', email: null, isPlatformAdmin: true },
  ];
  return {
    role: {
      findMany: vi.fn(async () => roles),
    },
  };
}

function adminSession(overrides: Record<string, unknown> = {}) {
  return {
    sub: 'u-admin',
    tier: 'pin',
    name: 'Platform Admin',
    roleCode: 'admin',
    platformAdmin: true,
    ...overrides,
  };
}

describe('/api/admin/roles', () => {
  beforeEach(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
    vi.clearAllMocks();
    vi.mocked(createClient).mockReturnValue(makeDb() as never);
  });

  it('UC-ADMIN-01: GET requires platform-admin', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({
      ok: true,
      session: adminSession({ platformAdmin: false }),
    } as never);
    const res = await GET(new Request('http://localhost/api/admin/roles'));
    expect(res.status).toBe(403);
  });

  it('UC-ADMIN-01: GET lists roles with pinConfigured flag', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({ ok: true, session: adminSession() } as never);
    vi.mocked(getSecretPlaintext).mockImplementation(async (key: string) =>
      key === 'ROLE_PIN_AMA' ? '4271' : null,
    );
    const res = await GET(new Request('http://localhost/api/admin/roles'));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { roles: { code: string; pinConfigured: boolean }[] } };
    const ama = json.data.roles.find((r) => r.code === 'ama');
    const admin = json.data.roles.find((r) => r.code === 'admin');
    expect(ama?.pinConfigured).toBe(true);
    expect(admin?.pinConfigured).toBe(false);
  });

  it('UC-ADMIN-02: POST sets a PIN for a known role', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({ ok: true, session: adminSession() } as never);
    vi.mocked(setSecret).mockResolvedValue(undefined);
    const res = await POST(
      new Request('http://localhost/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'made', pin: '8390' }),
      }),
    );
    expect(res.status).toBe(200);
    expect(setSecret).toHaveBeenCalledWith('ROLE_PIN_MADE', '8390');
  });

  it('UC-ADMIN-02: POST rejects unknown role code', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({ ok: true, session: adminSession() } as never);
    const res = await POST(
      new Request('http://localhost/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'ghost', pin: '1234' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('UC-ADMIN-02: POST rejects short PIN', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({ ok: true, session: adminSession() } as never);
    const res = await POST(
      new Request('http://localhost/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'made', pin: '12' }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it('UC-ADMIN-03: non-admin cannot set PINs', async () => {
    const { requireWriteAuth } = await import('@/lib/auth/guards');
    vi.mocked(requireWriteAuth).mockResolvedValue({
      ok: true,
      session: adminSession({ platformAdmin: false }),
    } as never);
    const res = await POST(
      new Request('http://localhost/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: 'made', pin: '8390' }),
      }),
    );
    expect(res.status).toBe(403);
  });
});
