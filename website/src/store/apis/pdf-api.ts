import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface PdfJobResponse {
  message: string;
  jobId: string;
  statusCheckUrl: string;
}

export interface PdfJobStatus {
  success: boolean;
  status: string;
  pdfBase64?: string;
  details?: string;
}

export const pdfApi = createApi({
  reducerPath: 'pdfApi',
  baseQuery,
  tagTypes: ['PdfJob'],
  endpoints: (builder) => ({
    queuePdf: builder.mutation<ApiEnvelope<PdfJobResponse>, string | void>({
      query: (page = '/') => ({
        url: 'auth',
        params: { action: 'pdf', page },
      }),
      invalidatesTags: ['PdfJob'],
    }),
    getPdfJobStatus: builder.query<PdfJobStatus, string>({
      query: (jobId) => `vjobs/status/${jobId}`,
      providesTags: (_result, _error, jobId) => [{ type: 'PdfJob', id: jobId }],
    }),
    /** Imperative poll for PDF worker completion (legacy ops pages). */
    pollPdfJob: builder.mutation<PdfJobStatus, string>({
      query: (jobId) => `vjobs/status/${jobId}`,
    }),
  }),
});

export const {
  useQueuePdfMutation,
  useGetPdfJobStatusQuery,
  useLazyGetPdfJobStatusQuery,
  usePollPdfJobMutation,
} = pdfApi;
