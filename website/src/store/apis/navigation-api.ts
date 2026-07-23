import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface NavigationItem {
  id: string;
  title: string;
  path: string | null;
  icon: string | null;
  authTier: string;
  requiredGroups: string[];
  isVisible: boolean;
  children?: NavigationItem[];
}

export const navigationApi = createApi({
  reducerPath: 'navigationApi',
  baseQuery,
  endpoints: (builder) => ({
    getNavigation: builder.query<ApiEnvelope<{ items: NavigationItem[] }>, { tier?: string; groups?: string } | void>({
      query: (params) => ({
        url: 'navigation',
        params: params ?? {},
      }),
    }),
  }),
});

export const {
  useGetNavigationQuery,
} = navigationApi;
