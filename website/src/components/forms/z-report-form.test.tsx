import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { ZReportForm } from '@/components/forms/z-report-form';
import { metricsApi } from '@/store/apis/metrics-api';

const saveHandler = vi.fn();

function makeTestStore() {
  return configureStore({
    reducer: {
      [metricsApi.reducerPath]: metricsApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(metricsApi.middleware),
  });
}

describe('ZReportForm', () => {
  afterEach(() => {
    cleanup();
    saveHandler.mockReset();
    vi.unstubAllGlobals();
  });

  it('submits z-report via metricsApi mutation', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : String(input);
      const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
      if (url.includes('/api/metrics') && method === 'POST') {
        const body = init?.body ?? (input instanceof Request ? await input.clone().text() : '');
        saveHandler(JSON.parse(String(body)));
        return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: {} }), { status: 200 });
    }));

    const store = makeTestStore();
    render(
      <Provider store={store}>
        <ZReportForm />
      </Provider>,
    );

    fireEvent.change(screen.getByLabelText('Report date'), { target: { value: '2026-06-15' } });
    fireEvent.change(screen.getByLabelText('Nett sales (IDR)'), { target: { value: '1250000' } });
    fireEvent.change(screen.getByLabelText('Total covers'), { target: { value: '42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Z-report' }));

    await waitFor(() => {
      expect(saveHandler).toHaveBeenCalledWith(expect.objectContaining({
        report_date: '2026-06-15',
        department: 'all_pos',
        nett_sales: 1250000,
        total_covers: 42,
      }));
    });

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent('Saved successfully');
    });
  });
});
