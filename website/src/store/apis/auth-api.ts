import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope, SessionPayload } from '@/store/api-types';

export const authApi = createApi({
  reducerPath: 'authApi',
  baseQuery,
  tagTypes: ['Session'],
  endpoints: (builder) => ({
    getSession: builder.query<ApiEnvelope<SessionPayload>, void>({
      query: () => 'auth?action=me',
      providesTags: ['Session'],
    }),
    verifyPin: builder.mutation<{ ok: boolean; success?: boolean }, { name?: string; role?: string; pin: string }>({
      query: (body) => ({
        url: 'auth?action=verify-pin',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Session'],
    }),
    logout: builder.mutation<void, void>({
      query: () => ({
        url: 'auth?action=logout',
        method: 'GET',
        responseHandler: 'text',
      }),
      invalidatesTags: ['Session'],
    }),
  }),
});

export const {
  useGetSessionQuery,
  useVerifyPinMutation,
  useLogoutMutation,
} = authApi;
