import { createSlice } from '@reduxjs/toolkit';
import type { AuthTier } from '@/lib/page-catalog';
import type { SessionUser } from '@/store/api-types';

export interface AuthState {
  tier: AuthTier;
  user: SessionUser | null;
  bootstrapped: boolean;
  roleCode?: string | null;
  platformAdmin?: boolean;
}

const initialState: AuthState = {
  tier: 'public',
  user: null,
  bootstrapped: false,
  roleCode: null,
  platformAdmin: false,
};

export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setSession(
      state,
      action: {
        payload: {
          tier: AuthTier;
          user: SessionUser | null;
          roleCode?: string | null;
          platformAdmin?: boolean;
        };
      },
    ) {
      state.tier = action.payload.tier;
      state.user = action.payload.user;
      state.roleCode = action.payload.roleCode ?? null;
      state.platformAdmin = action.payload.platformAdmin ?? false;
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
