import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/auth/guards', () => ({
  requireRead: vi.fn(),
  requireWrite: vi.fn(),
  requireWriteAuth: vi.fn(),
  requireSession: vi.fn(),
  requireGoogle: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  createClient: vi.fn(() => ({
    dailyZReport: {
      findMany: vi.fn().mockResolvedValue([
        {
          reportDate: new Date('2026-06-01T00:00:00.000Z'),
          nettSales: 411_000_000,
          totalCovers: 120,
          avgCovers: 171_250,
          totalBills: 80,
          gofoodAmount: 50_000_000,
          dineInAmount: 361_000_000,
          totCollectionAmount: 411_000_000,
          totalSales: 450_000_000,
          tax10Amount: 20_000_000,
          service7Amount: 19_000_000,
        },
      ]),
    },
    monthlyTarget: {
      findMany: vi.fn().mockResolvedValue([{ month: '2026-06', revenueTarget: 500_000_000 }]),
    },
    $queryRaw: vi.fn(),
  })),
}));

import { requireRead } from '@/lib/auth/guards';

describe('GET /api/financial-overview?resource=reports', () => {
  it('UC-RPT-01: returns daily rollup metrics', async () => {
    vi.mocked(requireRead).mockResolvedValue({
      ok: true,
      session: { sub: 'test-user', tier: 'pin' as const },
    });

    const response = await GET(
      new Request('http://localhost/api/financial-overview?resource=reports&period=daily'),
    );
    expect(response.status).toBe(200);
    const json = await response.json() as {
      success: boolean;
      data: { period: string; metrics: { date: string; revenue: number }[] };
    };
    expect(json.success).toBe(true);
    expect(json.data.period).toBe('daily');
    expect(json.data.metrics[0]?.date).toBe('2026-06-01');
    expect(json.data.metrics[0]?.revenue).toBe(411_000_000);
  });
});
