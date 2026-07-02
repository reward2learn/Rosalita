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
    title: 'Phase 1: Stop the Bleeding',
    period: 'July – September 2026',
    impact: 'Zero cost',
    actions: [
      'Fix loss-leading promotions (Monday/Wednesday bundles)',
      'Complete staff restructuring: 22 → 16 core FTE + casuals',
      'Lock in lower rent at IDR 30M/month through December 2027',
      'Deploy free AI tools (ChatGPT, Canva) for marketing',
      'Menu cleanup: remove Asian Corner, duplicate wings',
    ],
  },
  {
    id: 'P2',
    title: 'Phase 2: Menu & Revenue Optimization',
    period: 'October – December 2026',
    impact: 'IDR 130-210M/mo',
    actions: [
      'Upselling training for staff (starter, drink pairing, dessert)',
      'Launch weekend brunch Sat-Sun 10AM-2PM',
      'Selective price increases on underpriced items',
      'Launch daily Happy Hour 4-7PM',
      'Hotel concierge partnerships with 5 five-star hotels',
    ],
  },
  {
    id: 'P3',
    title: 'Phase 3: Growth & Sustainable Profitability',
    period: 'January – June 2027',
    impact: 'IDR 27-48M/mo',
    actions: [
      'Deploy Winnow food waste AI',
      'Launch direct WhatsApp ordering',
      'Target 85+ guests/day average',
      'Hostie AI phone assistant for 24/7 reservations',
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
