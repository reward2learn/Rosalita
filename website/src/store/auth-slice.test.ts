import { describe, expect, it } from 'vitest';
import { authSlice, resetAuth, setSession, setTier } from '@/store/auth-slice';

describe('authSlice', () => {
  it('starts unbootstrapped at public tier', () => {
    const state = authSlice.reducer(undefined, { type: 'init' });
    expect(state.tier).toBe('public');
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(false);
  });

  it('setSession stores tier and user', () => {
    const state = authSlice.reducer(
      undefined,
      setSession({
        tier: 'google',
        user: { id: 'u1', email: 'owner@redrubybali.com', authMethod: 'google' },
      }),
    );
    expect(state.tier).toBe('google');
    expect(state.user?.email).toBe('owner@redrubybali.com');
    expect(state.bootstrapped).toBe(true);
  });

  it('setTier updates tier without user', () => {
    const state = authSlice.reducer(undefined, setTier('pin'));
    expect(state.tier).toBe('pin');
    expect(state.bootstrapped).toBe(true);
  });

  it('resetAuth clears user and sets public tier', () => {
    const prior = authSlice.reducer(
      undefined,
      setSession({ tier: 'pin', user: { id: 'admin' } }),
    );
    const state = authSlice.reducer(prior, resetAuth());
    expect(state.tier).toBe('public');
    expect(state.user).toBeNull();
    expect(state.bootstrapped).toBe(true);
  });

  it('pin tier cannot satisfy google-only via slice alone (AuthGate enforces)', () => {
    const state = authSlice.reducer(
      undefined,
      setSession({ tier: 'pin', user: { id: 'admin', authMethod: 'pin' } }),
    );
    expect(state.tier).toBe('pin');
    expect(state.tier).not.toBe('google');
  });
});
