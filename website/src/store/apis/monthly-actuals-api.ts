import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface MonthlyActualsParams {
  period: string;
  department?: string;
  prefill?: boolean;
  prefill_from?: string;
  prefill_mode?: string;
  scope?: string;
  recent?: boolean;
  page?: number;
  limit?: number;
}

export const monthlyActualsApi = createApi({
  reducerPath: 'monthlyActualsApi',
  baseQuery,
  tagTypes: ['MonthlyActuals'],
  endpoints: (builder) => ({
    getMonthlyActuals: builder.query<ApiEnvelope<unknown>, MonthlyActualsParams>({
      query: (params) => ({
        url: 'financial-overview',
        params: {
          resource: 'monthly-actuals',
          ...params,
          ...(params.prefill ? { prefill: '1' } : {}),
          ...(params.recent ? { recent: '1' } : {}),
        },
      }),
      providesTags: (_result, _error, { period }) => [{ type: 'MonthlyActuals', id: period }],
    }),
    saveMonthlyActuals: builder.mutation<
      ApiEnvelope<unknown>,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: 'financial-overview?resource=monthly-actuals',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['MonthlyActuals'],
    }),
  }),
});

export const {
  useGetMonthlyActualsQuery,
  useLazyGetMonthlyActualsQuery,
  useSaveMonthlyActualsMutation,
} = monthlyActualsApi;
