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

interface Lever {
  num: number; title: string; summary: string; details: string[];
}

const FALLBACK_LEVERS: Lever[] = [
  { num: 1, title: 'Seasonal Cash Management', summary: 'Build IDR 500M+ cash reserve for low season', details: ['Allocate Oct-Dec surplus to cash reserve', 'Flex staffing down 20-30% during low season', 'Track daily BEP coverage'] },
  { num: 2, title: 'Revenue Growth', summary: 'Club + Terrace revenue growth · ticket tiering, VIP tables', details: ['Club ticket tiered pricing', 'VIP table service', 'Terrace 24h marketing'] },
  { num: 3, title: 'Cost Control', summary: 'Entertainment 14.5% → 8% of revenue', details: ['Negotiate DJ/performer residencies', 'Beverage inventory tracking', 'Reduce staff FTE'] },
  { num: 4, title: 'StarWORLD Membership', summary: '5 tiers, 10,000 members', details: ['Blue/Green/Gold/Platinum/Black tiers', 'Recurring revenue growth', 'Cross-venue access'] },
  { num: 5, title: 'Partnerships & Ecosystem', summary: 'Hotel concierge, promoter network', details: ['Hotel concierge partnerships', 'Promoter network optimization', 'Cross-promotion with ecosystem venues'] },
];

export function LeverAccordionBlock({ config }: { config: Record<string, unknown> }) {
  const { title } = parseBlockConfig('lever_accordion', config);
  const { data, isLoading } = useGetDashboardDataQuery();
  const [expanded, setExpanded] = useState<number | false>(false);

  const levers = !isLoading && data?.data?.levers?.length
    ? data.data.levers
    : (!isLoading ? FALLBACK_LEVERS : null);

  if (!levers) return null;

  return (
    <Box component="section" sx={{ mx: 'auto', px: 3, py: 4 }}>
      <Typography variant="h5" component="h2" sx={{ fontWeight: 800, textAlign: 'center', mb: 1 }}>
        {title ?? 'The 5 Levers'}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 3, maxWidth: 520, mx: 'auto' }}>
        Click each lever to see the actionable steps. Five interconnected strategies driving the turnaround.
      </Typography>
      {levers.map((lever) => (
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
            <Chip label={lever.num} size="small" sx={{ mr: 1.5, bgcolor: 'rgba(235, 61, 40, 0.12)', color: 'primary.main', fontWeight: 700 }} />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{lever.title}</Typography>
              <Typography variant="body2" color="text.secondary">{lever.summary}</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails>
            {(Array.isArray(lever.details) ? lever.details : [lever.details]).map((d) => (
              <Typography key={d} variant="body2" color="text.secondary" sx={{ pl: 1, mb: 0.75 }}>→ {d}</Typography>
            ))}
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
}
