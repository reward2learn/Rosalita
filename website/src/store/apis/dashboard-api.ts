import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface ActionPhase {
  id: string;
  title: string;
  period: string;
  impact: string;
  actions: string[];
}

export interface TargetRow {
  metric: string;
  may: number;
  conservative: number;
  realistic: number;
  aspirational: number;
  bold?: number;
}

export interface Lever {
  num: number;
  title: string;
  summary: string;
  details: string;
}

export interface DashboardData {
  actionPhases: ActionPhase[];
  targetRows: TargetRow[];
  levers: Lever[];
}

export const dashboardApi = createApi({
  reducerPath: 'dashboardApi',
  baseQuery,
  endpoints: (builder) => ({
    getDashboardData: builder.query<ApiEnvelope<DashboardData>, void>({
      query: () => 'dashboard-data',
    }),
    saveDashboardData: builder.mutation<ApiEnvelope<void>, DashboardData>({
      query: (body) => ({
        url: 'dashboard-data',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useGetDashboardDataQuery,
  useSaveDashboardDataMutation,
} = dashboardApi;
