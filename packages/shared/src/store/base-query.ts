import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Shared RTK Query base — session cookie only (no admin header).
 */
export const baseQuery = fetchBaseQuery({
  baseUrl: '/api',
  credentials: 'include',
});
