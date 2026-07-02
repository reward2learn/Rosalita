'use client';

import { useEffect, type ReactNode } from 'react';
import { useGetSessionQuery } from '@/store/apis/auth-api';
import { resetAuth, setSession } from '@/store/auth-slice';
import { useAppDispatch } from '@/store/hooks';

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const { data, isSuccess, isError } = useGetSessionQuery();

  useEffect(() => {
    if (isSuccess && data?.success) {
      dispatch(setSession({
        tier: data.data.tier,
        user: data.data.user,
      }));
      return;
    }
    if (isError) {
      dispatch(resetAuth());
    }
  }, [isSuccess, isError, data, dispatch]);

  return children;
}
