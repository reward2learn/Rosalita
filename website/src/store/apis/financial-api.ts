import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';
import type {
  ChartOverview,
  ForecastScenarioKey,
  PnlDetailResponse,
} from '@/domain/financial/financial-projection-service';

export type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export interface ReportMetricRow {
  date?: string;
  month?: string;
  period_start?: string | Date;
  revenue?: number | bigint | null;
  guests_count?: number | bigint | null;
  avg_spend?: number | null;
  gofood_revenue?: number | bigint | null;
  direct_orders?: number | bigint | null;
  tot_collection_amount?: number | bigint | null;
}

export interface ReportsPayload {
  period: ReportPeriod;
  metrics: ReportMetricRow[];
  targets: unknown[];
}

export const financialApi = createApi({
  reducerPath: 'financialApi',
  baseQuery,
  tagTypes: ['FinancialOverview', 'PnlDetail', 'Reports'],
  endpoints: (builder) => ({
    getChartOverview: builder.query<ApiEnvelope<ChartOverview>, ForecastScenarioKey | void>({
      query: (scenario = 'conservative') => ({
        url: 'financial-overview',
        params: { scenario },
      }),
      providesTags: ['FinancialOverview'],
    }),
    getPnlDetail: builder.query<ApiEnvelope<PnlDetailResponse>, string>({
      query: (period) => ({
        url: 'financial-overview',
        params: { period },
      }),
      providesTags: (_result, _error, period) => [{ type: 'PnlDetail', id: period }],
    }),
    getReports: builder.query<
      ApiEnvelope<ReportsPayload>,
      { period?: ReportPeriod }
    >({
      query: ({ period = 'monthly' } = {}) => ({
        url: 'financial-overview',
        params: { resource: 'reports', period },
      }),
      providesTags: ['Reports'],
    }),
    getTargets: builder.query<ApiEnvelope<unknown>, void>({
      query: () => ({
        url: 'financial-overview',
        params: { resource: 'reports', period: 'monthly' },
      }),
      providesTags: ['Reports'],
    }),
  }),
});

export const {
  useGetChartOverviewQuery,
  useGetPnlDetailQuery,
  useGetReportsQuery,
  useGetTargetsQuery,
} = financialApi;
