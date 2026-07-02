import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { SignInPanel } from '@/components/auth/sign-in-panel';
import { authSlice } from '@/store/auth-slice';
import { authApi } from '@/store/apis/auth-api';

vi.mock('next/navigation', () => ({
  usePathname: () => '/ops-admin',
  useSearchParams: () => new URLSearchParams(''),
}));

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

function renderPanel() {
  const store = configureStore({
    reducer: {
      auth: authSlice.reducer,
      [authApi.reducerPath]: authApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(authApi.middleware),
  });

  return render(
    <Provider store={store}>
      <SignInPanel requiredTier="pin" />
    </Provider>,
  );
}

describe('SignInPanel', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        mockFetchResponse({ ok: true, success: true }),
      ),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders PIN and Google options for pin tier', () => {
    renderPanel();
    expect(screen.getByTestId('sign-in-panel')).toBeInTheDocument();
    expect(screen.getByText('Ops Sign-In')).toBeInTheDocument();
    expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    expect(screen.getByTestId('pin-input')).toBeInTheDocument();
  });
});
