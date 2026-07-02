'use client';

import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import { MarkdownBody } from '@/components/blocks/markdown-body';
import { EXECUTIVE_SUMMARY_FALLBACK } from '@/domain/knowledge/knowledge-seed';
import { useGetDocumentQuery } from '@/store/apis/content-api';

const DOCUMENT_FALLBACKS: Record<string, string> = {
  'executive-summary': EXECUTIVE_SUMMARY_FALLBACK,
};

export interface DocMarkdownBlockProps {
  config: Record<string, unknown>;
  /** Server-provided markdown skips RTK document query (review pages). */
  initialMarkdown?: string;
}

export function DocMarkdownBlock({ config, initialMarkdown }: DocMarkdownBlockProps) {
  const { source, title } = parseBlockConfig('doc_markdown', config);
  const { data, isLoading, isError } = useGetDocumentQuery(source, {
    skip: !!initialMarkdown,
  });

  const body =
    initialMarkdown ?? data?.markdown ?? DOCUMENT_FALLBACKS[source] ?? '';

  return (
    <Box component="section" sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 5 }}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, md: 6 },
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'rgba(255,255,255,0.03)',
          lineHeight: 1.8,
        }}
      >
        {title ? (
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              mb: 2,
              pb: 1.25,
              borderBottom: '2px solid rgba(235, 61, 40, 0.3)',
            }}
          >
            {title}
          </Typography>
        ) : null}
        {isLoading && !initialMarkdown ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : isError && !body ? (
          <Typography variant="body1" color="text.secondary">
            Document content unavailable.
          </Typography>
        ) : (
          <MarkdownBody markdown={body} />
        )}
      </Paper>
    </Box>
  );
}
