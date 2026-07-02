/**
 * Rosalita Cantina Business Review — Knowledge Base
 * Used by /api/chat as the AI's system prompt context.
 * Contains all key data from the June 2026 turnaround analysis.
 */

export const BUSINESS_NAME = 'Rosalita Cantina';
export const LOCATION = 'Seminyak Square, Bali, Indonesia';

export const SITUATION_SUMMARY = `
Rosalita Cantina is a Tex-Mex restaurant in Seminyak Square, Bali. After losing IDR 443 million in January-April 2026 due to staff costs at 54-68%% of revenue (target: 22%%), May 2026 was the first EBITDA-positive month at +IDR 434K. Staff was reduced from 34 to 22 people.

The 12-month turnaround plan (June 2026 - June 2027) targets EBITDA from +IDR 434K/month to IDR 100-200M+/month through 5 levers:
1. Staff cost reduction (54-68%% → 22%% of revenue)
2. Menu consolidation (60 → 48 items, remove Asian Corner)
3. New revenue windows (Happy Hour 4-7PM daily, weekend brunch)
4. AI automation (ChatGPT, Canva, 7shifts, Winnow, Hostie)
5. Partnerships & Ecosystem Hub (Red Ruby 5AM breakfast, Prestix.vip, StarPOINTS, monthly industry events)
`;

export const CURRENT_METRICS = {
  may_2026: {
    revenue: 411_000_000, // IDR
    ebitda: 434_000,
    ebitda_margin_pct: 0.1,
    guests_per_day: 56,
    avg_spend: 220_000,
    staff_cost_pct: 40,
    staff_count: 22,
  },
};

export const TARGET_METRICS = {
  jun_2027_conservative: {
    monthly_revenue: 615_000_000,
    monthly_ebitda: 101_000_000,
    ebitda_margin_pct: 16.5,
    guests_per_day: 82,
    avg_spend: 250_000,
    staff_cost_pct: 22,
  },
  jun_2027_realistic: {
    monthly_revenue: 699_000_000,
    monthly_ebitda: 150_000_000,
    ebitda_margin_pct: 25,
    guests_per_day: 95,
    avg_spend: 265_000,
    staff_cost_pct: 22,
  },
  jun_2027_aspirational: {
    monthly_revenue: 819_000_000,
    monthly_ebitda: 298_000_000,
    ebitda_margin_pct: 32,
    guests_per_day: 100,
    avg_spend: 275_000,
    staff_cost_pct: 22,
  },
};

export const MONTHLY_TARGETS = [
  { month: '2026-06', revenue: 411_000_000, ebitda: 400_000, guests: 56, spend: 220_000, staffPct: 40 },
  { month: '2026-07', revenue: 430_000_000, ebitda: 5_000_000, guests: 60, spend: 225_000, staffPct: 38 },
  { month: '2026-08', revenue: 450_000_000, ebitda: 10_000_000, guests: 63, spend: 228_000, staffPct: 35 },
  { month: '2026-09', revenue: 480_000_000, ebitda: 20_000_000, guests: 65, spend: 230_000, staffPct: 32 },
  { month: '2026-10', revenue: 520_000_000, ebitda: 35_000_000, guests: 70, spend: 235_000, staffPct: 30 },
  { month: '2026-11', revenue: 550_000_000, ebitda: 50_000_000, guests: 73, spend: 238_000, staffPct: 28 },
  { month: '2026-12', revenue: 600_000_000, ebitda: 70_000_000, guests: 78, spend: 240_000, staffPct: 26 },
  { month: '2027-01', revenue: 620_000_000, ebitda: 85_000_000, guests: 80, spend: 245_000, staffPct: 25 },
  { month: '2027-02', revenue: 630_000_000, ebitda: 95_000_000, guests: 82, spend: 248_000, staffPct: 24 },
  { month: '2027-03', revenue: 650_000_000, ebitda: 110_000_000, guests: 85, spend: 250_000, staffPct: 23 },
  { month: '2027-04', revenue: 670_000_000, ebitda: 130_000_000, guests: 88, spend: 255_000, staffPct: 23 },
  { month: '2027-05', revenue: 685_000_000, ebitda: 155_000_000, guests: 92, spend: 260_000, staffPct: 22 },
  { month: '2027-06', revenue: 699_000_000, ebitda: 175_000_000, guests: 95, spend: 265_000, staffPct: 22 },
];

export const FIVE_LEVERS = [
  {
    num: 1,
    name: 'Staff Costs',
    impact: 'IDR 50-80M/month',
    target: '22%% of revenue (from 40-68%%)',
    actions: [
      'Reduce core FTE from 22 to 16',
      'Use part-time/casual for Fri-Sat peaks',
      'Implement 7shifts AI scheduling',
      'Cross-train staff for multi-role capability',
      'Track hours vs revenue daily, flag above 25%%'
    ],
  },
  {
    num: 2,
    name: 'Menu Consolidation',
    impact: 'IDR 10-20M/month',
    target: '48 items (from 60)',
    actions: [
      'Remove Asian Corner (6 items — brand mismatch)',
      'Remove duplicate Chicken Wings listings',
      'Merge Nachos & Mexi Fries into one line',
      'Fix Monday promo: 25%% off → bundle deal',
      'Fix Wednesday promo: 67%% off wings → wing+beer bundle',
      'Reduce taco/burrito fillings based on POS data',
      'Increase prices on underpriced items',
    ],
  },
  {
    num: 3,
    name: 'New Revenue Windows',
    impact: 'IDR 50-100M/month',
    target: 'Happy Hour, Brunch',
    actions: [
      'Daily Happy Hour 4-7PM: 20%% off cocktails, half-price apps',
      'Weekend brunch Sat-Sun 10AM-2PM: build-your-own taco bar',
      'Lunch combo deal 11AM-4PM: main + drink IDR 20K off',
      'Partner with 5 five-star hotels for concierge referrals',
    ],
  },
  {
    num: 4,
    name: 'AI Automation',
    impact: 'IDR 20-50M/month',
    target: 'ChatGPT, 7shifts, Winnow, Hostie',
    actions: [
      'ChatGPT (free): generate captions, respond to reviews',
      'Canva (free): design menu + social templates',
      '7shifts AI scheduling ($29/mo): auto-generate schedules',
      'Winnow food waste AI: camera tracks waste',
      'WhatsApp Business direct ordering (bypass 20-30%% GoFood)',
      'Hostie AI phone assistant ($200/mo): 24/7 reservations',
    ],
  },
  {
    num: 5,
    name: 'Partnerships & Ecosystem Hub',
    impact: 'IDR 34-115M/month',
    target: 'Red Ruby, Prestix.vip, StarPOINTS, industry events',
    actions: [
      'Red Ruby cross-promotion (dinner-to-club packages, shared events)',
      'Dinner + Red Ruby VIP cross-promotion package',
      'Prestix.vip profile for table booking',
      'StarPOINTS bonus program for loyalty',
      'Monthly sector-specific industry events (Massage & Spa, Villa, Tour, Wellness, F&B)',
    ],
  },
];

export const PRIORITY_ACTIONS = {
  P0_THIS_WEEK: [
    'Create ChatGPT + Canva accounts (free, 15min)',
    'Remove Asian Corner from GoFood, website, Instagram',
    'Fix Monday promo: 25%% off → bundle deal',
    'Fix Wednesday promo: 67%% off wings → wing+beer bundle',
    'Check 5AM alcohol licensing for Red Ruby partnership',
    'Set up Rosalita\'s profile on Prestix.vip',
  ],
  P1_THIS_MONTH: [
    'Launch daily Happy Hour 4-7PM',
    'Document cocktail menu pricing',
    'Launch Dinner + Red Ruby VIP package',
    'Sign up for 7shifts AI scheduling',
  ],
  P2_THIS_QUARTER: [
    'Launch weekend brunch Sat-Sun 10AM-2PM',
    'Contact 5 five-star hotels for concierge partnerships',
    'Activate bonus StarPOINTS program',
    'Implement Winnow food waste tracking',
    'Pilot first ecosystem industry event',
  ],
};

export const KEY_RISKS = [
  'Staff costs must stay under 22%% — this is the #1 profit killer',
  'Cocktail menu not yet priced in menu.txt — highest-margin category',
  'No POS sales data by item/day/time — 4-week tracking not started',
  'GoFood takes 20-30%% commission — direct ordering is critical',
  'Asian Corner brand mismatch must be removed from all digital menus',
  'Tax loss carryforward pool of IDR 1.1-1.2B worth IDR 242-264M in savings — expires in 5 years',
];

export const STRATEGIC_PARTNERSHIPS = {
  red_ruby: {
    name: 'Red Ruby Bali',
    type: '24/7 nightclub, 50m from Rosalita\'s',
    opportunity: 'Cross-promotion packages (dinner-to-club, VIP entry)',
    revenue_impact: 'IDR 10-25M/month additional EBITDA',
  },
  prestix_vip: {
    name: 'Prestix.vip',
    type: 'Table booking & experience platform',
    opportunity: 'Online reservations, StarXP payment, Find a Date commissions',
    revenue_impact: 'IDR 5-15M/month additional EBITDA',
  },
  industry_events: {
    name: 'StarWorld Ecosystem Hub Events',
    type: 'Monthly sector-specific industry nights',
    opportunity: 'Massage & Spa, Villa, Tour, Wellness, F&B — fill Tue/Wed slow nights',
    revenue_impact: 'IDR 14-75M/month additional EBITDA',
  },
};

export function buildSystemPrompt() {
  return `You are Rosalita AI — a business intelligence assistant for Rosalita Cantina, a Tex-Mex restaurant in Seminyak Square, Bali.

## Your Role
You help the owner/management team understand the business turnaround plan, track KPIs against projections, analyze operational data, and provide actionable insights. You have full knowledge of the June 2026 Business Review and can query the live database for actual performance data.

## Key Business Situation
${SITUATION_SUMMARY}

## 5 Levers of the Turnaround Plan
${FIVE_LEVERS.map(l => `${l.num}. ${l.name}: ${l.impact} — ${l.target}`).join('\n')}

## Monthly Projection Targets (Realistic Ramp)
${MONTHLY_TARGETS.map(t => `- ${t.month}: Rev ${formatIDR(t.revenue)}, EBITDA ${formatIDR(t.ebitda)}, ${t.guests} guests/day, ${formatIDR(t.spend)} avg spend, staff ${t.staffPct}%%`).join('\n')}

## Target Summary (June 2027)
- Conservative: ${formatIDR(615_000_000)}/mo revenue, ${formatIDR(101_000_000)}/mo EBITDA, 82 guests/day
- Realistic: ${formatIDR(699_000_000)}/mo revenue, ${formatIDR(150_000_000)}/mo EBITDA, 95 guests/day
- Aspirational: ${formatIDR(819_000_000)}/mo revenue, ${formatIDR(298_000_000)}/mo EBITDA, 100+ guests/day

## Priority Actions
P0 (This Week): ${PRIORITY_ACTIONS.P0_THIS_WEEK.join(', ')}
P1 (This Month): ${PRIORITY_ACTIONS.P1_THIS_MONTH.join(', ')}
P2 (This Quarter): ${PRIORITY_ACTIONS.P2_THIS_QUARTER.join(', ')}

## Strategic Partnerships
${Object.values(STRATEGIC_PARTNERSHIPS).map(p => `- ${p.name} (${p.type}): ${p.opportunity} — ${p.revenue_impact}`).join('\n')}

## Key Risks to Monitor
${KEY_RISKS.map(r => `- ${r}`).join('\n')}

## How You Answer
1. **Business Review Questions**: Answer from the knowledge base above — cite specific parts (Part A, Lever 2, P0 list, etc.) when relevant.
2. **Performance Analysis**: When asked about actual performance, KPIs, or tracking — I will query the database and provide the data. Ask me for specifics like "What was our revenue last month?" or "How are we tracking against the EBITDA target?" and I'll get the data.
3. **Data Queries**: I can fetch daily metrics, compare actuals vs targets, show trends, and highlight areas needing attention.
4. **Always be helpful, concise, and specific**. Use IDR formatting (e.g., "IDR 150M"). Reference the relevant Part of the Business Review or Lever number when giving advice.
5. If asked something outside the business review scope, politely redirect to what you can help with.

Keep responses conversational but data-driven. When showing numbers, put them in context.`;
}

function formatIDR(n) {
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `IDR ${(n / 1_000).toFixed(0)}K`;
  return `IDR ${n}`;
}
