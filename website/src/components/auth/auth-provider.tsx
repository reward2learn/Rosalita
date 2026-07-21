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
        roleCode: data.data.roleCode ?? null,
        platformAdmin:
          (data.data.platformAdmin ?? false) ||
          (data.data.groups ?? []).includes('platform-admin'),
        groups: data.data.groups ?? [],
        permissions: data.data.permissions ?? [],
      }));
      return;
    }
    if (isError) {
      dispatch(resetAuth());
    }
  }, [isSuccess, isError, data, dispatch]);

  return children;
}
