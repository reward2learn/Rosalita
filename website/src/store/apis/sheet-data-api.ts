import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface SheetDataParams {
  sheet: string;
  page?: number;
  perPage?: number;
}

export interface SheetDataResponse {
  sheet: string;
  columns: string[];
  rows: Record<string, unknown>[];
  totalRows: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export const sheetDataApi = createApi({
  reducerPath: 'sheetDataApi',
  baseQuery,
  endpoints: (builder) => ({
    getSheetData: builder.query<ApiEnvelope<SheetDataResponse>, SheetDataParams>({
      query: (params) => ({
        url: 'sheet-data',
        params: {
          sheet: params.sheet,
          page: params.page ?? 1,
          perPage: params.perPage ?? 200,
        },
      }),
    }),
  }),
});

export const {
  useGetSheetDataQuery,
} = sheetDataApi;
