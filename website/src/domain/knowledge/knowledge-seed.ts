/** Seed fallback snippets — sourced from Red Ruby Executive Summary & Business Review. */

export const EXECUTIVE_SUMMARY_FALLBACK = `# Red Ruby Club & Terrace Bar — Executive Summary (MVP Exit Viability)
### PT Taman Bintang Bali | Prepared for Graham Bristow & Co-Stakeholders
### Date: July 2026

---

## The Appointment Mandate

Graham Bristow formally commissioned this review to understand why Red Ruby is under pressure financially and operationally — revenues dropping, gross margins compressing, supplier debt increasing, money leaking, and guests choosing other venues. This is an **exit viability assessment**, not a growth strategy.

---

## Current State Summary

| Metric | Value | Assessment |
|--------|-------|-----------|
| Jun 2026 Revenue | IDR 1.975B | Declining from Jan peak (IDR 2.28B) |
| Gross Margin Range | 51–62% | **Sector benchmark: 65–72%** — critically below standard |
| Fixed Costs/mo | ~IDR 1,050M | Exceeds low-season revenue capacity |
| Entertainment / Revenue | 14.5% | Industry norm: 6–10%; this is a primary margin destroyer |
| Supplier Debt Trend | Increasing | Estimated IDR 1.2–1.5B outstanding (requires Ama's audit to confirm) |
| EBITDA May 2026 | +IDR 166M | Only month with meaningful surplus; peaks not covering troughs |

---

## Exit Viability — Assessment

**Revenue trajectory is negative**: Jan was the high point of the observed period. Peaks do not exceed prior-year levels. Low-season months are getting deeper, not shallower.

**Gross margin erosion confirms structural cost failure**: A 59% gross margin in nightclub operations means COS at 38.8%. Industry-standard COS for nightclubs is 28–35%. The difference — 3.8 to 10.8 percentage points above benchmark — represents IDR 70–190M per month in unnecessary spend.

**Entertainment cost at 14.5% revenue is unsustainable**: Entertainment should cap at 10%. Red Ruby spends ~IDR 325M/month on talent when market rates for equivalent service are ~IDR 195–304M. This creates a margin death spiral when combined with declining attendance.

**Estimated exit value pathways**:
- **Pathway 1 — License + PT entity intact**: IDR 8–15B (licenses have standalone scarcity value in Bali)
- **Pathway 2 — Related-party transfer to StarWORLD co.**: IDR 5–10B (constrained by arm's-length requirements)
- **Pathway 3 — Management buyout with earn-out**: IDR 3–8B (lower base; requires management funding)
- **Pathway 4 — Liquidation**: IDR 1–3B (only FF&E recovery after creditor settlements)

**Exit window: 60–90 days from July 2026.** Beyond that, deteriorating financial signals reduce buyer interest and negotiating position significantly.

---

## Critical Actions by Stakeholder

### Ama (Financial)
- Produce full supplier aging report (Week 1–2)
- Complete inter-company reconciliation: Red Ruby ↔ StarWORLD flow (Week 4)
- Model liquidity stress test: worst-case cash runway (Week 2)
- Build sell-side clean books snapshot (Week 8)

### Made (Compliance & Legal)
- Confirm PT share transferability and permit transfer rules (Week 1–2)
- Audit inter-company transaction compliance (Week 4)
- Survey supplier contract exit/novation terms (Week 2)
- Calculate employment law severance exposure (Week 4)

### Lukas (Operations & Promoters)
- Stop ghost promoter spending via POS audit (Week 2)
- Implement operational cost freeze targeting IDR 900M/month floor (Immediate)
- Catalog FF&E with market resale estimates (Week 3)
- Negotiate extended supplier terms for sell-side cooperation (Week 2)

### James (Music & DJs)
- Convert talent to residencies; cut entertainment to ≤IDR 180M/month (Week 2)
- Identify which acts drive attendance lift vs. waste (Week 2)
- Build in-house residency roster reducing dependency on expensive visiting talent (Week 4)

### Graham Bristow (Shareholder)
- Set floor price with Ama — calculate minimum acceptable offer (Week 4)
- Identify 3–5 likely buyers (other operators, regional entrants, affiliate) (Week 4)
- Decide: full exit vs. advisory role vs. minority hold post-transfer (Immediate)

---

> **Bottom Line**: Red Ruby's operational model cannot sustain itself under current ownership. Enterprise value exists in the PT entity, nightclub licenses (scarce in Bali), and physical assets. Graham has 60–90 days to prepare for sale before market signals of distress eliminate buyer interest.
`;

export const KNOWLEDGE_SEED_SNIPPETS = [
  {
    key: 'executive_summary',
    category: 'document',
    content: EXECUTIVE_SUMMARY_FALLBACK,
  },
  {
    key: 'business_overview',
    category: 'overview',
    content: `Red Ruby Club & Terrace Bar (PT Taman Bintang Bali) is a nightclub and bar in Petitenget, Bali. The venue operates across three revenue streams: Club (nightclub with beverage, ticket, and VIP table service), Terrace 24h (all-day bar with food and beverage), and a planned Sky Lounge (2029 launch). May 2026 revenue was IDR 2.24B with 61.1% gross margin and BEP coverage of 1.24x. The business has a seasonal pattern — strong Jan and May, weak Feb-Mar during Bali's low season.`,
  },
  {
    key: 'revenue_streams',
    category: 'strategy',
    content: `Three revenue streams: (1) Club — 146-200 guests/night at IDR 400K-438K spend, ~70% of revenue from beverage, tickets, shisha, cigarettes. (2) Terrace 24h — 50-80 guests/night at IDR 225K-270K spend, ~20% of revenue. (3) Sky Lounge (2029+) — planned 80-110 guests/night at IDR 450K-510K spend. StarWORLD membership program with 5 tiers (Blue, Green, Gold, Platinum, Black/VVIP).`,
  },
  {
    key: 'may_2026_metrics',
    category: 'metrics',
    content: `May 2026 actuals: Revenue IDR 2,235,602,109, COS IDR 868,619,170 (38.8%), Gross Profit IDR 1,366,982,939 (61.1%), Payroll IDR 616,978,740 (27.6%), Other Fixed IDR 487,469,676 (21.8%), Total Fixed IDR 1,104,448,416, EBITDA +IDR 166,480,378 (7.5%), BEP Revenue IDR 1.8B, BEP Coverage 1.24x.`,
  },
  {
    key: 'june_2026_variance',
    category: 'metrics',
    content: `June 2026 vs May 2026: Revenue IDR 1,975M (-11.6%), COS IDR 757M (-12.8%), Gross Margin 61.7% (+0.5pp), Payroll IDR 620M (+0.5%), BEP Coverage 1.11x (-0.13x). June shows seasonal decline but improved cost efficiency.`,
  },
  {
    key: 'ten_year_targets',
    category: 'metrics',
    content: `2026-2035 growth targets: Revenue IDR 30.7B → IDR 110.2B, EBITDA IDR 2.2B → IDR 26.9B (8.6% → 29.5% margin), Staff 73 → 117, Annual guests 76,468 → 177,480, Avg spend IDR 402K → IDR 621K. Sky Lounge launches 2029 adding IDR 13B revenue.`,
  },
  {
    key: 'priority_actions',
    category: 'actions',
    content: `P0: Build cash reserve to IDR 500M for seasonal coverage, finalize staff restructuring to 73 FTE. P1: Negotiate DJ/performer residencies (saves 15-20% entertainment cost), implement beverage inventory tracking, launch StarWORLD membership drive. P2: Sky Lounge business case, seasonal staffing model.`,
  },
  {
    key: 'key_risks',
    category: 'risks',
    content: `Key risks: seasonal revenue collapse Jan-Mar (high fixed costs IDR 1B/month vs low revenue), new venue competition in Petitenget/Seminyak, regulatory/permitting risk for nightclub hours, entertainment talent cost escalation, Sky Lounge launch delays. Mitigation: cash reserves, StarWORLD loyalty, flex staffing, legal budget.`,
  },
  {
    key: 'staff_structure',
    category: 'overview',
    content: `73 FTE across 10 departments: Management (4), Supervisor (2), Admin/Cashier/Merchandiser (6), Bar Staff (10), Host/Floor/Waiter (12), Marketing & GRO (12), Kitchen (7), Security & Valet (10), Store/Cleaning (6), Daily/Contract Worker (4). Annual payroll: IDR 6.58B. Flexible staffing needed for low season (Jan-Mar).`,
  },
  {
    key: 'cost_structure',
    category: 'metrics',
    content: `Cost structure: COS 38.8% (Beverage 17.9%, Food 2.9%, Entertainment 14.5%, Promoter fees 2.5%). Fixed costs 49.4% (Payroll 27.6%, Operating 7.8%, Marketing 5.1%, Property 6.9%, Overhead 4.8%). Target: reduce fixed costs to IDR 950M/month for sustainable BEP coverage at 1.5x.`,
  },
] as const;

export const MONTHLY_TARGETS_SEED = [
  { month: '2026-06', revenue: 1975_000_000, ebitda: 262_000_000, guests: 4392, spend: 527_000, staffPct: 27 },
  { month: '2026-07', revenue: 2100_000_000, ebitda: 280_000_000, guests: 4600, spend: 500_000, staffPct: 26 },
  { month: '2026-08', revenue: 2250_000_000, ebitda: 320_000_000, guests: 4800, spend: 480_000, staffPct: 25 },
  { month: '2026-09', revenue: 2400_000_000, ebitda: 360_000_000, guests: 5000, spend: 470_000, staffPct: 24 },
  { month: '2026-10', revenue: 2550_000_000, ebitda: 400_000_000, guests: 5300, spend: 460_000, staffPct: 23 },
  { month: '2026-11', revenue: 2650_000_000, ebitda: 430_000_000, guests: 5500, spend: 455_000, staffPct: 22 },
  { month: '2026-12', revenue: 2786_000_000, ebitda: 450_000_000, guests: 5700, spend: 450_000, staffPct: 22 },
  { month: '2027-01', revenue: 2800_000_000, ebitda: 460_000_000, guests: 5800, spend: 448_000, staffPct: 21 },
  { month: '2027-02', revenue: 2100_000_000, ebitda: 200_000_000, guests: 4200, spend: 455_000, staffPct: 23 },
  { month: '2027-03', revenue: 2250_000_000, ebitda: 250_000_000, guests: 4500, spend: 450_000, staffPct: 22 },
  { month: '2027-04', revenue: 2600_000_000, ebitda: 350_000_000, guests: 5000, spend: 445_000, staffPct: 21 },
  { month: '2027-05', revenue: 2900_000_000, ebitda: 500_000_000, guests: 5600, spend: 440_000, staffPct: 20 },
  { month: '2027-06', revenue: 3200_000_000, ebitda: 600_000_000, guests: 6000, spend: 438_000, staffPct: 19 },
] as const;

function formatIdr(n: number): string {
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `IDR ${(n / 1_000).toFixed(0)}K`;
  return `IDR ${n}`;
}

export function buildStructuredPromptFromSnippets(
  snippets: { key: string; category: string; content: string }[],
): string {
  const byCategory = new Map<string, string[]>();
  for (const s of snippets) {
    const list = byCategory.get(s.category) ?? [];
    list.push(s.content);
    byCategory.set(s.category, list);
  }

  const sections: string[] = [
    'You are Red Ruby AI — a business intelligence assistant for Red Ruby Club & Terrace Bar, a nightclub and bar in Petitenget, Bali, operated by PT Taman Bintang Bali.',
    '',
    '## Your Role',
    'Help management track KPIs, analyze operational data, monitor break-even performance, and provide actionable insights for the club, terrace bar, and planned Sky Lounge.',
  ];

  const categoryTitles: Record<string, string> = {
    overview: '## Key Business Information',
    strategy: '## Revenue & Growth Strategy',
    metrics: '## Metrics & Targets',
    actions: '## Priority Actions',
    risks: '## Key Risks to Monitor',
  };

  for (const [category, contents] of byCategory) {
    const title = categoryTitles[category] ?? `## ${category}`;
    sections.push('', title, contents.join('\n\n'));
  }

  const targetsBlock = MONTHLY_TARGETS_SEED.map(
    (t) => `- ${t.month}: Rev ${formatIdr(t.revenue)}, EBITDA ${formatIdr(t.ebitda)}, ${t.guests} guests/month`,
  ).join('\n');

  sections.push(
    '',
    '## Monthly Projection Targets',
    targetsBlock,
    '',
    '## How You Answer',
    '1. Use IDR formatting (e.g., "IDR 2.2B", "IDR 166M").',
    '2. Reference specific Business Review parts when relevant.',
    '3. Use live database data for performance tracking questions.',
    '4. Be concise and data-driven.',
    '5. Highlight BEP coverage and margin metrics.',
  );

  return sections.join('\n');
}
