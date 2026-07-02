import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { DynamicPage } from '@/components/dynamic/dynamic-page';
import { PAGE_CATALOG } from '@/lib/page-catalog';
import { makeStore } from '@/store';
import { setSession } from '@/store/auth-slice';

vi.mock('react-chartjs-2', () => ({
  Chart: () => <div data-testid="financial-chart-mock" />,
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('month=Aug%2B2026'),
  usePathname: () => '/ops-tracking',
}));

function mockFetchResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
    clone: function clone() {
      return mockFetchResponse(data, ok, status);
    },
    headers: new Headers({ 'content-type': 'application/json' }),
  };
}

const overviewPayload = {
  success: true,
  data: {
    labels: ['Jan 2026', 'Feb 2026', 'Aug 2026'],
    actual: {
      revenue: [1, 2, 3],
      ebitda: [1, 2, 3],
      net_income: [1, 2, 3],
      guests: [1, 2, 3],
      staff_cost: [1, 2, 3],
    },
    forecast: {
      revenue: [1, 2, 3],
      ebitda: [1, 2, 3],
      net_income: [1, 2, 3],
      guests: [1, 2, 3],
      staff_cost: [1, 2, 3],
    },
    scenario: 'conservative',
    scenario_year: 2027,
    scenario_label: 'Conservative',
    ebitda_target: 'IDR 101M/mo EBITDA',
  },
};

describe('ops-tracking DynamicPage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders rollup, chart, and seeds P&L from month query param', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((input: string | URL) => {
        const url = String(input);
        if (url.includes('resource=reports')) {
          return Promise.resolve(
            mockFetchResponse({
              success: true,
              data: {
                period: 'monthly',
                metrics: [{ month: '2026-06', revenue: 100, guests_count: 10 }],
                targets: [],
              },
            }),
          );
        }
        if (url.includes('period=2026-08')) {
          return Promise.resolve(
            mockFetchResponse({
              success: true,
              data: {
                chart_period: '2026-08',
                scenarios: {
                  conservative: { lines: [{ key: 'revenue', label: 'Revenue', value: 100 }] },
                },
              },
            }),
          );
        }
        if (url.includes('financial-overview')) {
          return Promise.resolve(mockFetchResponse(overviewPayload));
        }
        if (url.includes('auth?action=me')) {
          return Promise.resolve(
            mockFetchResponse({
              success: true,
              data: { tier: 'google', user: { id: '1', name: 'Test' } },
            }),
          );
        }
        return Promise.resolve(mockFetchResponse({ success: true, data: {} }));
      }),
    );

    const store = makeStore();
    store.dispatch(setSession({ tier: 'google', user: { id: '1', name: 'Test' } }));

    render(
      <Provider store={store}>
        <DynamicPage page={PAGE_CATALOG['ops-tracking']} />
      </Provider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Z-Report Rollup')).toBeInTheDocument();
      expect(screen.getByText('Financial Projections')).toBeInTheDocument();
      expect(screen.getByText('Monthly P&L Breakdown')).toBeInTheDocument();
    });
  });
});
