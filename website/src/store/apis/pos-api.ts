import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';

export interface PosApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PosParseData {
  text?: string;
  inputs?: Record<string, number>;
  [key: string]: unknown;
}

export const posApi = createApi({
  reducerPath: 'posApi',
  baseQuery,
  endpoints: (builder) => ({
    scanPosReceipt: builder.mutation<PosApiResponse<{ text: string }>, { images: string[] }>({
      query: (body) => ({
        url: 'pos?action=scan',
        method: 'POST',
        body,
      }),
    }),
    parsePosText: builder.mutation<
      PosApiResponse<Record<string, unknown>>,
      { text: string; useAi?: boolean }
    >({
      query: (body) => ({
        url: 'pos?action=parse',
        method: 'POST',
        body,
      }),
    }),
    scanExpenseReceipt: builder.mutation<PosApiResponse<{ text: string }>, { images: string[] }>({
      query: (body) => ({
        url: 'pos?action=expense-scan',
        method: 'POST',
        body,
      }),
    }),
    parseExpenseText: builder.mutation<
      PosApiResponse<PosParseData>,
      { text: string; department: string; useAi?: boolean }
    >({
      query: (body) => ({
        url: 'pos?action=expense-parse',
        method: 'POST',
        body,
      }),
    }),
  }),
});

export const {
  useScanPosReceiptMutation,
  useParsePosTextMutation,
  useScanExpenseReceiptMutation,
  useParseExpenseTextMutation,
} = posApi;
