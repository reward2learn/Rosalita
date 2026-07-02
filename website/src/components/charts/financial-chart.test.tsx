import { describe, expect, it, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { FinancialChart } from '@/components/charts/financial-chart';

describe('FinancialChart', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows empty state when labels are empty', () => {
    render(
      <FinancialChart
        kpi="ebitda"
        labels={[]}
        actual={[]}
        forecast={[]}
      />,
    );

    expect(screen.getByText('No chart data yet')).toBeInTheDocument();
    expect(screen.getByText(/bun run seed/i)).toBeInTheDocument();
  });

  it('shows loading state', () => {
    render(
      <FinancialChart
        kpi="ebitda"
        labels={[]}
        actual={[]}
        forecast={[]}
        isLoading
      />,
    );

    expect(screen.queryByText('No chart data yet')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
