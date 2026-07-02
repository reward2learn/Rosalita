import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/auth/guards', () => ({
  requireWriteAuth: vi.fn(async () => ({
    ok: false,
    response: new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
  })),
}));

describe('POST /api/config/reseed', () => {
  it('returns 401 without session cookie', async () => {
    const formData = new FormData();
    formData.append('excel', new File(['x'], 'test.xlsx', { type: 'application/vnd.ms-excel' }));

    const request = new Request('http://localhost/api/config/reseed', {
      method: 'POST',
      body: formData,
    });

    const response = await POST(request);
    expect(response.status).toBe(401);

    const json = (await response.json()) as { success: boolean; error: string };
    expect(json.success).toBe(false);
    expect(json.error).toBeTruthy();
  });
});
