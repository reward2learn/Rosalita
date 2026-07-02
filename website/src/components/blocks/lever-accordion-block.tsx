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

const LEVERS = [
  {
    num: 1,
    title: 'Staff Costs',
    summary: '54-68% → 22% of revenue · IDR 50-80M/mo',
    details: [
      'Reduce core FTE from 22 → 16 (waitstaff, bar, kitchen)',
      'Use part-time/casual staff for Fri-Sat peaks',
      'Implement 7shifts AI scheduling from sales data',
      'Cross-train staff for multi-role capability',
      'Track hours worked vs. revenue daily — flag any day above 25% labor ratio',
    ],
  },
  {
    num: 2,
    title: 'Menu Fixes',
    summary: '60 → 48 items, remove Asian Corner, fix promos · IDR 10-20M/mo',
    details: [
      'Remove Asian Corner — brand mismatch',
      'Remove duplicate Chicken Wings listings',
      'Fix Monday/Wednesday promos to bundle deals',
      'Reduce taco/burrito fillings from 7 to 4-5 based on POS data',
      'Increase prices on underpriced items (Chicken Fingers, Cobb Salad, Churros)',
    ],
  },
  {
    num: 3,
    title: 'New Revenue Windows',
    summary: 'Happy Hour, Brunch, Late-night · IDR 50-100M/mo',
    details: [
      'Launch daily Happy Hour 4-7PM',
      'Weekend brunch Sat-Sun 10AM-2PM',
      'Late-night window Fri-Sat after 10PM',
      'Hotel concierge partnerships within 1km',
    ],
  },
  {
    num: 4,
    title: 'AI Automation',
    summary: 'ChatGPT + Canva, 7shifts, Winnow · IDR 20-50M/mo',
    details: [
      'ChatGPT + Canva for daily social posts',
      '7shifts AI scheduling pilot',
      'Winnow food waste AI over kitchen bins',
      'Hostie AI phone assistant for reservations',
    ],
  },
  {
    num: 5,
    title: 'Partnerships & Ecosystem Hub',
    summary: 'Red Ruby, Prestix.vip, StarPOINTS · IDR 34-115M/mo',
    details: [
      'Red Ruby breakfast cross-promotion',
      'Prestix.vip venue profile',
      'StarPOINTS deepening',
      'Monthly industry events at Rosalita\'s',
    ],
  },
];

export function LeverAccordionBlock({ config }: { config: Record<string, unknown> }) {
  const { title } = parseBlockConfig('lever_accordion', config);
  const [expanded, setExpanded] = useState<number | false>(false);

  return (
    <Box component="section" sx={{ maxWidth: 800, mx: 'auto', px: 3, py: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        {title ?? 'The 5 Levers'}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ textAlign: 'center', mb: 3, maxWidth: 520, mx: 'auto' }}
      >
        Click each lever to see the actionable steps. Five interconnected strategies driving the turnaround.
      </Typography>
      {LEVERS.map((lever) => (
        <Accordion
          key={lever.num}
          expanded={expanded === lever.num}
          onChange={(_, isExpanded) => setExpanded(isExpanded ? lever.num : false)}
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
            <Chip
              label={lever.num}
              size="small"
              sx={{
                mr: 1.5,
                bgcolor: 'rgba(235, 61, 40, 0.12)',
                color: 'primary.main',
                fontWeight: 700,
              }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {lever.title}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {lever.summary}
              </Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {lever.details.map((d) => (
              <Typography key={d} variant="body2" color="text.secondary" sx={{ pl: 1, mb: 0.75 }}>
                → {d}
              </Typography>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
