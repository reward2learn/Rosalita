'use client';

import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { parseBlockConfig } from '@/lib/schemas/block-config';

const PHASES = [
  {
    id: 'P1',
    title: 'Phase 1: Stabilize — Stop the Bleeding',
    period: 'July – September 2026',
    impact: 'Target: IDR 150-235M/mo EBITDA · BEP Coverage 1.1x → 1.35x',
    actions: [
      'Build IDR 500M+ cash reserve from Jun-Sep surpluses to cover Jan-Mar low season',
      'Reduce staff from 80 → 75 FTE (Host/Waiter 14→12, Marketing 15→12, Security 12→10) — saving IDR 60M/month',
      'Cut entertainment costs 10%: negotiate DJ/performer 3-month residencies vs per-night fees (saves IDR 20-25M/month)',
      'Implement beverage inventory tracking to reduce wastage 10% (saves IDR 40M/month)',
      'Track daily BEP coverage — trigger cost containment if below 0.9x',
      'Flex seasonal staffing template for Jan-Mar low season (revenue drops 36% from Jan peak to Feb trough)',
    ],
  },
  {
    id: 'P2',
    title: 'Phase 2: Growth — Build Revenue Momentum',
    period: 'October 2026 – June 2027',
    impact: 'Target: IDR 2.7-3.2B/mo Revenue · EBITDA IDR 200-600M/mo · Margin 8% → 15%',
    actions: [
      'Launch Club tiered ticket pricing (early bird, standard, VIP) to increase yield 15-20% (adds IDR 30-40M/month)',
      'VIP table service: target 5-10 tables/night at IDR 3M-10M each (adds IDR 50-100M/month)',
      'Optimize promoter/influencer spend — track cost-per-guest and cut underperforming channels',
      'Hotel concierge partnerships: secure 5+ referral agreements within Petitenget/Seminyak (target 20-30 guests/night)',
      'Expand Terrace 24h marketing as only all-night venue in area — target 65→85 guests/night',
      'Launch StarWORLD membership drive across all 5 tiers (Blue through Black/VVIP) — target 10,000 members',
      'Negotiate bulk spirits purchasing for top 5 moving brands (reduces beverage COS from 26% to 24%)',
    ],
  },
  {
    id: 'P3',
    title: 'Phase 3: Profitability — Scale & Structure',
    period: 'July 2027 – December 2029',
    impact: 'Target: IDR 42.2B → 65.4B/yr Revenue · EBITDA IDR 7.5B → 15.5B · Margin 21.5% → 28.6%',
    actions: [
      'Launch Sky Lounge (2029): 80 guests/night at IDR 450K spend = IDR 12.96B annual revenue, 15-20 new FTE',
      'Scale StarWORLD to 120,000 members across all tiers (IDR 183.6B total program value)',
      'Expand Club capacity: 200 → 300 guests/night by 2030 through layout optimization and event programming',
      'Develop in-house DJ/performer roster to reduce external entertainment costs from 14.5% → 8% of revenue',
      'Staff scaling plan: 73 → 117 FTE by 2035, maintaining staff cost below 16% of revenue (from 26% in 2026)',
      'Build second venue pipeline: assess Petitenget/Seminyak expansion opportunities for 2031+',
      'Target 29.5% EBITDA margin by 2035 on IDR 110.2B annual revenue',
    ],
  },
];

export function ActionChecklistBlock({ config }: { config: Record<string, unknown> }) {
  parseBlockConfig('action_checklist', config);
  const [expanded, setExpanded] = useState<string | false>('P1');

  return (
    <Box component="section" sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        Step-by-Step Action Plan
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', mb: 3, maxWidth: 520, mx: 'auto' }}
      >
        Three phases from survival to sustainable profitability. Click each phase to expand.
      </Typography>
      {PHASES.map((phase) => (
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
