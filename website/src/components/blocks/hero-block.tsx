'use client';

import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Link from 'next/link';
import type { Route } from 'next';
import { AuthGate } from '@/components/auth/auth-gate';
import { parseBlockConfig } from '@/lib/schemas/block-config';

const EMBER = 'Cantina';

export function HeroBlock({ config }: { config: Record<string, unknown> }) {
  const { headline, subtitle, badge } = parseBlockConfig('hero', config);

  return (
    <Box
      component="section"
      sx={{
        textAlign: 'center',
        py: { xs: 7, md: 9 },
        px: 3,
        background: (theme) =>
          `radial-gradient(ellipse 80% 60% at 50% 40%, rgba(235, 61, 40, 0.08) 0%, transparent 70%), ${theme.palette.background.default}`,
      }}
    >
      {badge ? (
        <Chip
          label={badge}
          size="small"
          sx={{
            mb: 2.5,
            letterSpacing: '1.5px',
            textTransform: 'uppercase',
            fontSize: '10px',
            fontWeight: 600,
            color: 'text.primary',
            bgcolor: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        />
      ) : null}
      <Typography
        variant="h2"
        component="h1"
        sx={{
          fontWeight: 800,
          fontSize: { xs: '2.2rem', md: '3.4rem' },
          letterSpacing: '-0.03em',
          lineHeight: 1.08,
        }}
      >
        {headline ?? 'Rosalita'}
        <br />
        <Box component="span" sx={{ color: 'primary.main' }}>
          {headline ? '& Turnaround Strategy' : EMBER}
        </Box>
      </Typography>
      {subtitle ? (
        <Typography
          variant="body1"
          sx={{ mt: 1.75, color: 'text.secondary', maxWidth: 600, mx: 'auto' }}
        >
          {subtitle}
        </Typography>
      ) : null}

      <AuthGate
        requiredTier="pin"
        fallback={null}
      >
        <Grid container spacing={2} sx={{ mt: 6, maxWidth: 560, mx: 'auto' }}>
          <AuthGate requiredTier="google" fallback={
            <Grid size={{ xs: 12 }}>
              <ReportCard href="/ops-admin" title="Ops Admin" />
            </Grid>
          }>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ReportCard href="/summary" title="Executive Summary" />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <ReportCard href="/review/part-a" title="Full Business Review" />
            </Grid>
          </AuthGate>
        </Grid>
      </AuthGate>
    </Box>
  );
}

function ReportCard({ href, title }: { href: string; title: string }) {
  return (
    <Paper
      component={Link}
      href={href as Route}
      elevation={0}
      sx={{
        display: 'block',
        p: 3,
        textDecoration: 'none',
        color: 'inherit',
        bgcolor: 'rgba(255,255,255,0.03)',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        transition: 'all 0.25s ease',
        '&:hover': {
          borderColor: 'primary.main',
          bgcolor: 'rgba(235, 61, 40, 0.06)',
          transform: 'translateY(-2px)',
        },
      }}
    >
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        {title}
      </Typography>
    </Paper>
  );
}
