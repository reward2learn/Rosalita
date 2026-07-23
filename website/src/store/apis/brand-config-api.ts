import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import type { ApiEnvelope } from '@/store/api-types';

export interface BrandConfig {
  brandLogoText: string;
  brandLogoUrl: string | null;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
}

export const brandConfigApi = createApi({
  reducerPath: 'brandConfigApi',
  baseQuery,
  endpoints: (builder) => ({
    getBrandConfig: builder.query<ApiEnvelope<BrandConfig>, void>({
      query: () => 'brand-config',
    }),
  }),
});

export const {
  useGetBrandConfigQuery,
} = brandConfigApi;
