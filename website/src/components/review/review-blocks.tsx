'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { getReviewPartDisplayTitle, listReviewParts, setDynamicReviewParts } from '@/lib/page-catalog';
import type { ReviewPartDefinition } from '@/lib/page-catalog';
import { useGetReviewPartQuery } from '@/store/apis/content-api';
import { useEffect, useMemo, useState } from 'react';

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
  const router = useRouter();
  const { data, isLoading } = useGetReviewPartQuery(partSlug);
  const href = `/review/${partSlug}` as Route;

  return (
    <Paper
      id={partSlug}
      elevation={0}
      onClick={() => router.push(href)}
      onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(href); } }}
      tabIndex={0}
      role="button"
      aria-label={`Open ${data?.title ?? partSlug}`}
      sx={{
        ...reviewCardSx,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        maxHeight: { xs: 'min(420px, 70dvh)', md: 360 },
        p: 2.5,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        '&:hover': {
          borderColor: 'primary.main',
          boxShadow: '0 0 0 1px rgba(235,61,40,0.2)',
        },
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
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
          onClick={(e: React.MouseEvent) => e.stopPropagation()}
        >
          Open Part
        </Button>
      </Stack>
    </Paper>
  );
}

const ANCHOR_SELECT_LABEL = 'Jump to review section';
const PART_GROUPS = [
  { range: 'A–D', slugs: ['part-a', 'part-b', 'part-c', 'part-d'], desc: 'current situation, action plan, projections, and risk register' },
  { range: 'E–H', slugs: ['part-e', 'part-f', 'part-g', 'part-h'], desc: 'menu, timeline, immediate actions, and website review' },
  { range: 'I–L', slugs: ['part-i', 'part-j', 'part-k', 'part-l'], desc: 'revenue drivers, competitive context, AI automation, and final assessment' },
  { range: 'M–O', slugs: ['part-m', 'part-n', 'part-o'], desc: 'partnerships, ecosystem strategy, and tax notes' },
];

export function ReviewBlocks() {
  const [dbState, setDbState] = useState<'loading' | 'empty' | 'populated'>('loading');

  // On mount, fetch all review parts from the DB and register in the catalog
  useEffect(() => {
    fetch('/api/config/seed-details')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.reviewPartDetails?.length) {
          const parts: ReviewPartDefinition[] = data.reviewPartDetails.map(
            (p: { slug: string; partKey: string; title: string }) => ({
              partSlug: p.slug,
              partKey: p.partKey,
              title: p.title,
              authTier: 'google' as const,
            }),
          );
          setDynamicReviewParts(parts);
          setDbState('populated');
        } else {
          setDbState('empty');
        }
      })
      .catch(() => setDbState('empty'));
  }, []);

  const parts = useMemo(() => {
    if (dbState !== 'populated') return [];
    return listReviewParts();
  }, [dbState]);

  const scrollToPart = (partSlug: string) => {
    globalThis.document
      ?.getElementById(partSlug)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // ── Loading state ──────────────────────────────────────
  if (dbState === 'loading') {
    return (
      <Box component="section" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 12 }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  // ── Empty state — no seeded content in database ────────
  if (dbState === 'empty') {
    return (
      <Box component="section" sx={{ mx: 'auto', px: 3, py: 4 }}>
        <Typography variant="h6" color="text.secondary" sx={{ textAlign: 'center', py: 8 }}>
          No Business Review content available. Seed the database or generate content via the AI Content Generation tab.
        </Typography>
      </Box>
    );
  }

  // ── Populated — render all review blocks ───────────────
  return (
    <Box component="section" sx={{ mx: 'auto', px: 3, py: 4, minWidth: 0 }}>
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
          <Typography variant="h6" sx={{ fontWeight: 800, mb: 1.5 }}>
            Review Operating Notes
          </Typography>
          <Stack spacing={1}>
            {PART_GROUPS.map((group) => {
              // Only show a group when all its slugs are present in the catalog
              const existingSlugs = group.slugs.filter((slug) =>
                parts.some((p) => p.partSlug === slug),
              );
              if (existingSlugs.length === 0) return null;
              return (
                <Typography key={group.range} variant="body2" color="text.secondary">
                  Use Parts{' '}
                  {existingSlugs.map((slug, idx) => {
                    const { title } = parts.find((p) => p.partSlug === slug) ?? {};
                    const isLast = idx === existingSlugs.length - 1;
                    const display = title ? getReviewPartDisplayTitle(title) : `Part ${slug.replace('part-', '').toUpperCase()}`;
                    return (
                      <span key={slug}>
                        <Link
                          href={`/review/${slug}` as Route}
                          style={{ textDecoration: 'none' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Typography
                            component="span"
                            variant="body2"
                            sx={{
                              color: 'primary.main',
                              fontWeight: 600,
                              '&:hover': { textDecoration: 'underline', color: 'primary.light' },
                            }}
                          >
                            {display}
                          </Typography>
                        </Link>
                        {isLast ? '' : ', '}
                      </span>
                    );
                  })}{' '}
                  for {group.desc}.
                </Typography>
              );
            })}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
