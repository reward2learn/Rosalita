import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { AuthGate } from '@/components/auth/auth-gate';
import { authSlice } from '@/store/auth-slice';

function renderWithTier(tier: 'public' | 'pin' | 'google', bootstrapped = true) {
  const store = configureStore({
    reducer: { auth: authSlice.reducer },
    preloadedState: {
      auth: { tier, user: null, bootstrapped, groups: [], permissions: [] },
    },
  });

  return render(
    <Provider store={store}>
      <AuthGate requiredTier="google" fallback={<p>Google sign-in required</p>}>
        <p>Protected content</p>
      </AuthGate>
    </Provider>,
  );
}

describe('AuthGate', () => {
  it('denies PIN tier on google-only routes', () => {
    renderWithTier('pin');
    expect(screen.getByText('Google sign-in required')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('allows google tier on google-only routes', () => {
    renderWithTier('google');
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('shows loading fallback until bootstrap completes', () => {
    renderWithTier('google', false);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });
});
