import { createSlice } from '@reduxjs/toolkit';
import type { AuthTier } from '@/lib/page-catalog';
import type { SessionUser } from '@/store/api-types';

export interface AuthState {
  tier: AuthTier;
  user: SessionUser | null;
  bootstrapped: boolean;
}

const initialState: AuthState = {
  tier: 'public',
  user: null,
  bootstrapped: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(
      state,
      action: { payload: { tier: AuthTier; user: SessionUser | null } },
    ) {
      state.tier = action.payload.tier;
      state.user = action.payload.user;
      state.bootstrapped = true;
    },
    setTier(state, action: { payload: AuthTier }) {
      state.tier = action.payload;
      state.bootstrapped = true;
    },
    resetAuth(state) {
      state.tier = 'public';
      state.user = null;
      state.bootstrapped = true;
    },
  },
});

export const { setSession, setTier, resetAuth } = authSlice.actions;
