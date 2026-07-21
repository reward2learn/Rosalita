import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { ReportsRollupBlock } from '@/components/blocks/reports-rollup-block';
import { makeStore } from '@/store';

function mockFetchResponse(data: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone: function clone() {
      return mockFetchResponse(data);
    },
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

describe('ReportsRollupBlock', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders monthly rollup table from financial API', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes('reports')) {
          return Promise.resolve(
            mockFetchResponse({
              success: true,
              data: {
                period: 'monthly',
                metrics: [
                  {
                    month: '2026-06',
                    revenue: 411_000_000,
                    guests_count: 2400,
                    avg_spend: 171_250,
                    gofood_revenue: 50_000_000,
                    direct_orders: 361_000_000,
                  },
                ],
                targets: [],
              },
            }),
          );
        }
        return Promise.resolve(mockFetchResponse({ success: true, data: {} }));
      }),
    );

    const store = makeStore();
    render(
      <Provider store={store}>
        <ReportsRollupBlock config={{}} />
      </Provider>,
    );

    expect(screen.getByText('Z-Report Rollup')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId('reports-rollup-table')).toBeInTheDocument();
      expect(screen.getByText('Period')).toBeInTheDocument();
    });
  });
});
