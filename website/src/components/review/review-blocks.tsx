'use client';

import Link from 'next/link';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { MarkdownBody } from '@/components/blocks/markdown-body';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { getReviewPartDisplayTitle, listReviewParts } from '@/lib/page-catalog';
import { useGetReviewPartQuery } from '@/store/apis/content-api';

const reviewCardSx = {
  border: '1px solid',
  borderColor: 'divider',
  bgcolor: 'rgba(255,255,255,0.03)',
  minWidth: 0,
  overflow: 'auto',
} as const;

function excerpt(markdown: string | undefined): string {
  if (!markdown) return 'Seeded review content is not available yet. Open the part page for the catalog title.';
  return markdown
    .replace(/^#+\s+/gm, '')
    .replace(/\|.+\|/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260);
}

function ReviewPartBlock({ partSlug }: { partSlug: string }) {
  const { data, isLoading } = useGetReviewPartQuery(partSlug);
  const href = `/review/${partSlug}` as Route;

  return (
    <Paper
      id={partSlug}
      elevation={0}
      sx={{
        ...reviewCardSx,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        maxHeight: { xs: 'min(420px, 70dvh)', md: 360 },
        p: 2.5,
      }}
    >
      <Stack spacing={1.5} sx={{ flex: 1, minHeight: 0, minWidth: 0 }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 800, flexShrink: 0 }}>
          {data?.title ?? partSlug}
        </Typography>
        <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'auto' }}>
          {isLoading ? (
            <CircularProgress size={20} />
          ) : (
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              {excerpt(data?.markdown)}
            </Typography>
          )}
        </Box>
        <Button
          component={Link}
          href={href}
          variant="outlined"
          sx={{ alignSelf: 'flex-start', flexShrink: 0 }}
        >
          Open Part
        </Button>
      </Stack>
    </Paper>
  );
}

const ANCHOR_SELECT_LABEL = 'Jump to review section';

export function ReviewBlocks() {
  const parts = listReviewParts();

  const scrollToPart = (partSlug: string) => {
    globalThis.document
      ?.getElementById(partSlug)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <Box component="section" sx={{ maxWidth: 1180, mx: 'auto', px: 3, py: 4, minWidth: 0 }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="overline" color="primary.main" sx={{ fontWeight: 700 }}>
            Business Review
          </Typography>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800 }}>
            Review Blocks A-O
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The full June 2026 review is split into accessible blocks with dedicated part pages for deep reading and PDF export.
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ ...reviewCardSx, p: 2.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
            Anchor Navigation
          </Typography>
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <FormControl fullWidth size="small">
              <InputLabel id="review-anchor-select-label">{ANCHOR_SELECT_LABEL}</InputLabel>
              <Select
                labelId="review-anchor-select-label"
                id="review-anchor-select"
                value=""
                displayEmpty
                label={ANCHOR_SELECT_LABEL}
                onChange={(event) => scrollToPart(event.target.value)}
                inputProps={{ 'aria-label': ANCHOR_SELECT_LABEL }}
                renderValue={() => ANCHOR_SELECT_LABEL}
              >
                {parts.map((part) => (
                  <MenuItem key={part.partSlug} value={part.partSlug}>
                    {getReviewPartDisplayTitle(part.title)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Stack direction="row" sx={{ display: { xs: 'none', md: 'flex' }, flexWrap: 'wrap', gap: 1, minWidth: 0 }}>
            {parts.map((part) => (
              <Button
                key={part.partSlug}
                href={`#${part.partSlug}`}
                size="small"
                variant="text"
                sx={{ textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.35 }}
              >
                {getReviewPartDisplayTitle(part.title)}
              </Button>
            ))}
          </Stack>
        </Paper>

        <Grid container spacing={2} sx={{ minWidth: 0 }}>
          {parts.map((part) => (
            <Grid key={part.partSlug} size={{ xs: 12, md: 6 }} sx={{ display: 'flex', minWidth: 0, minHeight: 0 }}>
              <ReviewPartBlock partSlug={part.partSlug} />
            </Grid>
          ))}
        </Grid>

        <Paper
          elevation={0}
          sx={{
            ...reviewCardSx,
            p: 2.5,
            bgcolor: 'rgba(235,61,40,0.08)',
            maxHeight: { xs: 'min(320px, 50dvh)', md: 'none' },
            '@media print': { breakInside: 'avoid' },
          }}
        >
          <MarkdownBody markdown={[
            '## Review Operating Notes',
            '- Use Parts A-D for the current situation, action plan, projections, and risk register.',
            '- Use Parts E-H for menu, timeline, immediate actions, and website review.',
            '- Use Parts I-L for revenue drivers, competitive context, AI automation, and final assessment.',
            '- Use Parts M-O for partnerships, ecosystem strategy, and tax notes.',
          ].join('\n\n')} />
        </Paper>
      </Stack>
    </Box>
  );
}
