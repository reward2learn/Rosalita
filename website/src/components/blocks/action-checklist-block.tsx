'use client';

import { useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { parseBlockConfig } from '@/lib/schemas/block-config';
import { useGetDashboardDataQuery } from '@/store/apis/dashboard-api';

interface Phase {
  id: string; title: string; period: string; impact: string; actions: string[];
}

const FALLBACK_PHASES: Phase[] = [
  {
    id: 'P1',
    title: 'Phase 1: Stabilize — Stop the Bleeding',
    period: 'July – September 2026',
    impact: 'Target: IDR 150-235M/mo EBITDA · BEP Coverage 1.1x → 1.35x',
    actions: [
      'Build IDR 500M+ cash reserve from Jun-Sep surpluses to cover Jan-Mar low season',
      'Reduce staff from 80 → 75 FTE — saving IDR 60M/month',
      'Cut entertainment costs 10%: negotiate DJ/performer 3-month residencies',
      'Implement beverage inventory tracking to reduce wastage 10%',
      'Track daily BEP coverage — trigger cost containment if below 0.9x',
    ],
  },
  {
    id: 'P2',
    title: 'Phase 2: Growth — Build Revenue Momentum',
    period: 'October 2026 – June 2027',
    impact: 'Target: IDR 2.7-3.2B/mo Revenue · EBITDA IDR 200-600M/mo',
    actions: [
      'Launch Club tiered ticket pricing to increase yield 15-20%',
      'VIP table service: target 5-10 tables/night at IDR 3M-10M each',
      'Optimize promoter/influencer spend — track cost-per-guest',
      'Expand Terrace 24h marketing as only all-night venue in area',
      'Launch StarWORLD membership drive across all 5 tiers',
    ],
  },
];

export function ActionChecklistBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('action_checklist', config);
  const { data, isLoading } = useGetDashboardDataQuery();
  const [expanded, setExpanded] = useState<string | false>('P1');

  const phases = !isLoading && data?.data?.actionPhases?.length
    ? data.data.actionPhases
    : (!isLoading ? FALLBACK_PHASES : null);

  if (!phases) return null;

  return (
    <Box component="section" sx={{ mx: 'auto', px: 3, py: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        Step-by-Step Action Plan
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3, maxWidth: 520, mx: 'auto' }}>
        Three phases from survival to sustainable profitability. Click each phase to expand.
      </Typography>
      {phases.map((phase) => (
        <Accordion
          key={phase.id}
          expanded={expanded === phase.id}
          onChange={(_, isExpanded) => setExpanded(isExpanded ? phase.id : false)}
          elevation={0}
          sx={{
            mb: 1.5,
            bgcolor: 'rgba(255,255,255,0.03)',
            border: '1px solid',
            borderColor: 'divider',
            '&:before': { display: 'none' },
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ color: 'primary.main' }} />}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {phase.title}{' '}
                <Typography component="span" variant="body2" color="text.secondary">
                  — {phase.period}
                </Typography>
              </Typography>
            </Box>
            <Chip label={phase.impact} size="small" color="primary" variant="outlined" sx={{ ml: 1 }} />
          </AccordionSummary>
          <AccordionDetails>
            {phase.actions.map((action) => (
              <Typography key={action} variant="body2" color="text.secondary" sx={{ mb: 0.75 }}>
                • {action}
              </Typography>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
