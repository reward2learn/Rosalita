'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import { AuthGate } from '@/components/auth/auth-gate';
import { SignInPanelGate } from '@/components/auth/sign-in-panel';
import { KpiCardsBlock } from '@/components/blocks/kpi-cards-block';
import { ChartFinancialBlock } from '@/components/blocks/chart-financial-block';
import { ReportsRollupBlock } from '@/components/blocks/reports-rollup-block';
import { PnlTableBlock } from '@/components/blocks/pnl-table-block';

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  if (value !== index) return null;
  return <Box sx={{ pt: 2 }}>{children}</Box>;
}

export default function OpsTrackingPage() {
  const [tab, setTab] = useState(0);

  return (
    <AuthGate requiredTier="google" fallback={<SignInPanelGate requiredTier="google" />}>
      <Box sx={{ maxWidth: 960, mx: 'auto', px: 3, py: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 2 }}>
          Financial Tracking
        </Typography>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            <Tab label="Z-Report" />
            <Tab label="Projections" />
            <Tab label="Breakdown" />
          </Tabs>
        </Paper>

        {/* Z-Report tab: KPI cards + reports rollup */}
        <TabPanel value={tab} index={0}>
          <KpiCardsBlock config={{ variant: 'ops' }} />
          <ReportsRollupBlock config={{}} />
        </TabPanel>

        {/* Projections tab: financial chart */}
        <TabPanel value={tab} index={1}>
          <ChartFinancialBlock config={{ variant: 'ops' }} />
        </TabPanel>

        {/* Breakdown tab: P&L table */}
        <TabPanel value={tab} index={2}>
          <PnlTableBlock config={{}} />
        </TabPanel>
      </Box>
    </AuthGate>
  );
}
