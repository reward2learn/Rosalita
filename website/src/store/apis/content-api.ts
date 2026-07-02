import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQuery } from '@/store/base-query';
import { PAGE_CATALOG, resolvePage, resolveReviewPart, type PageDefinition } from '@/lib/page-catalog';

export interface ReviewPartContent {
  slug: string;
  title: string;
  markdown?: string;
}

/**
 * Page layout from catalog (runtime SSoT); markdown bodies from /api/content after P6 seed.
 */
export const contentApi = createApi({
  reducerPath: 'contentApi',
  baseQuery,
  tagTypes: ['Page', 'ReviewPart', 'Document'],
  endpoints: (builder) => ({
    getPage: builder.query<PageDefinition, string>({
      queryFn: (slug) => {
        const page = resolvePage(slug);
        if (!page) {
          return { error: { status: 404, data: `Unknown page slug: ${slug}` } };
        }
        return { data: page };
      },
      providesTags: (_result, _error, slug) => [{ type: 'Page', id: slug }],
    }),
    listPages: builder.query<PageDefinition[], void>({
      queryFn: () => ({ data: Object.values(PAGE_CATALOG) }),
      providesTags: ['Page'],
    }),
    getReviewPart: builder.query<ReviewPartContent, string>({
      queryFn: async (partSlug, _api, _extra, baseQuery) => {
        const catalog = resolveReviewPart(partSlug);
        if (!catalog) {
          return { error: { status: 404, data: `Unknown review part: ${partSlug}` } };
        }
        const result = await baseQuery({
          url: 'content',
          params: { source: `review:${partSlug}` },
        });
        if (result.error) {
          return {
            data: { slug: partSlug, title: catalog.title },
          };
        }
        const payload = result.data as { markdown?: string; title?: string };
        return {
          data: {
            slug: partSlug,
            title: payload.title ?? catalog.title,
            markdown: payload.markdown,
          },
        };
      },
      providesTags: (_result, _error, slug) => [{ type: 'ReviewPart', id: slug }],
    }),
    getDocument: builder.query<{ markdown: string }, string>({
      query: (source) => `content?source=${encodeURIComponent(source)}`,
      providesTags: (_result, _error, source) => [{ type: 'Document', id: source }],
    }),
  }),
});

export const {
  useGetPageQuery,
  useListPagesQuery,
  useGetReviewPartQuery,
  useGetDocumentQuery,
} = contentApi;
