import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface MetricsListParams {
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  source?: string;
  export?: boolean;
}

export const metricsApi = createApi({
  reducerPath: 'metricsApi',
  baseQuery,
  tagTypes: ['Metrics', 'ZReportSchema', 'ZReportCalendar', 'ZReportDetail'],
  endpoints: (builder) => ({
    getSchema: builder.query<ApiEnvelope<unknown>, string | void>({
      query: (department = 'all_pos') => ({
        url: 'metrics',
        params: { schema: '1', department },
      }),
      providesTags: ['ZReportSchema'],
    }),
    getCalendar: builder.query<ApiEnvelope<unknown>, string>({
      query: (period) => ({
        url: 'metrics',
        params: { calendar: period },
      }),
      providesTags: (_result, _error, period) => [{ type: 'ZReportCalendar', id: period }],
    }),
    getDetail: builder.query<
      ApiEnvelope<unknown>,
      { date: string; department?: string }
    >({
      query: ({ date, department = 'all_pos' }) => ({
        url: 'metrics',
        params: { detail: date, department },
      }),
      providesTags: (_result, _error, { date }) => [{ type: 'ZReportDetail', id: date }],
    }),
    listMetrics: builder.query<ApiEnvelope<unknown>, MetricsListParams | void>({
      query: (params) => {
        const p = params ?? {};
        return {
          url: 'metrics',
          params: {
            ...p,
            ...(p.export ? { export: '1' } : {}),
          },
        };
      },
      providesTags: ['Metrics'],
    }),
    saveZReport: builder.mutation<ApiEnvelope<unknown>, Record<string, unknown>>({
      query: (body) => ({
        url: 'metrics',
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Metrics', 'ZReportDetail', 'ZReportCalendar'],
    }),
    importMetrics: builder.mutation<
      ApiEnvelope<unknown>,
      Record<string, unknown>
    >({
      query: (body) => ({
        url: 'metrics',
        method: 'POST',
        body: { action: 'import', ...body },
      }),
      invalidatesTags: ['Metrics', 'ZReportCalendar'],
    }),
    deleteZReport: builder.mutation<
      ApiEnvelope<unknown>,
      { report_date?: string; period?: string; scope?: string }
    >({
      query: (params) => ({
        url: 'metrics',
        method: 'DELETE',
        params,
      }),
      invalidatesTags: ['Metrics', 'ZReportDetail', 'ZReportCalendar'],
    }),
  }),
});

export const {
  useGetSchemaQuery,
  useGetCalendarQuery,
  useGetDetailQuery,
  useListMetricsQuery,
  useSaveZReportMutation,
  useImportMetricsMutation,
  useDeleteZReportMutation,
} = metricsApi;
