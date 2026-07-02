import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ChartFinancialBlock } from '@/components/blocks/chart-financial-block';
import { authSlice } from '@/store/auth-slice';
import { uiSlice } from '@/store/ui-slice';
import { financialApi } from '@/store/apis/financial-api';

const mockOverview = {
  success: true,
  data: {
    labels: ['Jan 2026', 'Feb 2026', 'Mar 2026'],
    actual: {
      ebitda: [100000, 200000, null],
      revenue: [400000000, 410000000, null],
      net_income: [50000, 60000, null],
      guests: [50, 55, null],
      staff_cost: [160000000, 165000000, null],
    },
    forecast: {
      ebitda: [null, null, 300000],
      revenue: [null, null, 420000000],
      net_income: [null, null, 70000],
      guests: [null, null, 60],
      staff_cost: [null, null, 170000000],
    },
    scenario: 'conservative' as const,
    scenario_year: 2027,
    scenario_label: 'Conservative',
    ebitda_target: 'IDR 101M/mo EBITDA',
  },
};

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(''),
}));

vi.mock('@/components/charts/financial-chart', () => ({
  FinancialChart: () => <div data-testid="financial-chart-mock" />,
}));

function makeTestStore() {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      ui: uiSlice.reducer,
      [financialApi.reducerPath]: financialApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(financialApi.middleware),
  });
  store.dispatch(
    financialApi.util.upsertQueryData('getChartOverview', 'conservative', mockOverview),
  );
  return store;
}

describe('ChartFinancialBlock', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    cleanup();
  });

  it('renders KPI filter buttons and chart', () => {
    const store = makeTestStore();
    render(
      <Provider store={store}>
        <ChartFinancialBlock config={{ variant: 'dashboard', minTier: 'public' }} />
      </Provider>,
    );

    expect(screen.getByText('Profitability Overview')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EBITDA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Revenue' })).toBeInTheDocument();
    expect(screen.getByTestId('financial-chart-mock')).toBeInTheDocument();
  });

  it('switches KPI when filter button clicked', () => {
    const store = makeTestStore();
    render(
      <Provider store={store}>
        <ChartFinancialBlock config={{ variant: 'dashboard' }} />
      </Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Revenue' }));
    expect(store.getState().ui.chartKpi).toBe('revenue');
  });

  it('shows scenario target cards on dashboard variant', () => {
    const store = makeTestStore();
    render(
      <Provider store={store}>
        <ChartFinancialBlock config={{ variant: 'dashboard' }} />
      </Provider>,
    );

    expect(screen.getByText('Conservative')).toBeInTheDocument();
    expect(screen.getByText('IDR 101M')).toBeInTheDocument();
  });
});
