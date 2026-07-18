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
    title: 'Seasonal Cash Management',
    summary: 'Build IDR 500M+ cash reserve for low season · Feb-Mar coverage',
    details: [
      'Allocate Oct-Dec surplus to cash reserve (IDR 150-200M/month)',
      'Flex staffing down 20-30% during Jan-Mar low season',
      'Maintain minimum 2 months of fixed costs in reserve (IDR 2B)',
      'Track daily BEP coverage — flag any day below 0.8x',
      'Negotiate supplier payment terms to smooth cash outflows',
    ],
  },
  {
    num: 2,
    title: 'Revenue Growth',
    summary: 'Club + Terrace + Sky Lounge · IDR 30.7B → 110.2B (2035)',
    details: [
      'Club ticket tiered pricing to increase yield 15-20%',
      'VIP table service — target 5-10 tables/night at IDR 3M-10M',
      'Terrace 24h marketing as only all-night venue in area',
      'Sky Lounge launch 2029 (IDR 13B annual revenue)',
      'Optimize promoter/influencer ROI by tracking cost-per-guest',
    ],
  },
  {
    num: 3,
    title: 'Cost Control',
    summary: 'Entertainment 14.5% → 8%, beverage wastage reduction · IDR 50-80M/mo',
    details: [
      'Negotiate DJ/performer residencies (3-6 month contracts)',
      'Implement beverage inventory tracking to reduce wastage 10%',
      'Bulk spirits purchasing for top 5 moving brands',
      'Reduce staff from 80 to 73 FTE, saving IDR 60M/month',
      'Seasonal staffing template for Jan-Mar low season',
    ],
  },
  {
    num: 4,
    title: 'StarWORLD Membership',
    summary: '5 tiers, 10,000 members · IDR 183.6B total program value',
    details: [
      'Blue (10 StarXP): 5,000 members — entry tier upselling to Green',
      'Green (100 StarXP): 4,000 members — core loyalty tier',
      'Gold (500 StarXP): 950 members — premium tier',
      'Platinum (1,000 StarXP): 45 members — VIP tier',
      'Black/VVIP (10,000 StarXP): 5 members — ultra-premium',
    ],
  },
  {
    num: 5,
    title: 'Partnerships & Ecosystem',
    summary: 'StarPOINTS, promoter network, hotel concierge · IDR 200-400M/mo',
    details: [
      'StarPOINTS loyalty integration across all revenue streams',
      'Hotel concierge partnerships within Petitenget/Seminyak',
      'Promoter network optimization for weekend events',
      'Monthly industry events at Red Ruby',
      'Cross-promotion with StarWORLD ecosystem venues',
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
