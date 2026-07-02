/** Seed fallback snippets — sourced from knowledge-base.js for P6 seed; not runtime SSoT. */
export const EXECUTIVE_SUMMARY_FALLBACK = `# Rosalita Cantina — Executive Summary
### 12-Month Turnaround Plan | June 2026

**The situation in one sentence**: After losing IDR 443M in Jan-Apr, May 2026 was the first EBITDA-positive month (+IDR 434K). The model works when costs are controlled. Now we scale it.

---

## The 5 Levers

| # | Lever | What It Does | Est. EBITDA Impact |
|---|-------|-------------|-------------------|
| 1 | **Staff costs** | 54-68% → 22% of revenue (already 34→22 staff) | IDR 50-80M/month |
| 2 | **Menu consolidation** | 60 → 48 items, remove Asian Corner, fix promos | IDR 10-20M/month |
| 3 | **New revenue windows** | Happy Hour (daily 4-7PM), Brunch (Sat-Sun), Late-night | IDR 50-100M/month |
| 4 | **AI automation** | ChatGPT + Canva (free), 7shifts, Winnow | IDR 20-50M/month |
| 5 | **Partnerships** | Red Ruby breakfast, Prestix.vip, StarPOINTS deepening | IDR 20-40M/month |

---

## The Target

| Metric | May 2026 Now | Jun 2027 Conservative | Jun 2027 Realistic | Jun 2027 Aspirational |
|--------|-------------|----------------------|--------------------|-----------------------|
| Monthly Revenue | IDR 411M | IDR 615M | IDR 699M | IDR 819M+ |
| **Monthly EBITDA** | **+IDR 434K** | **+IDR 101M** | **IDR 150-200M** | **IDR 298M** |
| EBITDA Margin | 0.1% | 16.5% | ~25% | ~32% |
| Guests/Day | 56 | 82 | 88-100 | 100+ |
| Avg Spend/Guest | ~IDR 220K | IDR 250K | IDR 265K | IDR 275K+ |

---

## Do This Week (P0 — Zero Cost, Immediate ROI)

- [ ] **Create ChatGPT + Canva accounts** — free, 15min setup → start posting daily content, responding to reviews
- [ ] **Remove Asian Corner** from GoFood, website, and Instagram menu photos (brand mismatch, 6 items gone)
- [ ] **Fix Monday promo** — change "25% off everything" to a bundle deal (e.g., 2 tacos + drink IDR 120K)
- [ ] **Fix Wednesday promo** — change "67% off wings" to wing + beer bundle (6 wings + beer IDR 85K)
- [ ] **Check 5AM alcohol licensing** — verify if early-morning service is allowed (unlocks Red Ruby partnership)
- [ ] **Set up Prestix.vip profile** — list Rosalita's on the booking platform (takes 2 hours)

---

## Do This Month (P1)

- [ ] Launch daily **Happy Hour** (4-7PM): 20% off cocktails + half-price appetizers
- [ ] Document **cocktail menu pricing** in menu.txt (highest-margin, not yet documented)
- [ ] Pilot **5AM breakfast** at Rosalita's (2 weekends, limited menu)
- [ ] Launch **"Dinner + Red Ruby VIP"** cross-promotion package
- [ ] Sign up for **7shifts AI scheduling** software

---

## Do This Quarter (P2 — Oct-Dec 2026)

- [ ] Launch **weekend brunch** (Sat-Sun 10AM-2PM)
- [ ] Extend **Fri-Sat hours to 1AM**
- [ ] Contact **5 five-star hotels** within 1km for concierge partnerships
- [ ] Expand 5AM breakfast to **Fri-Sun** (12 mornings/month)
- [ ] Activate **bonus StarPOINTS** program (first visit, slow days, cocktail orders)
- [ ] Implement **Winnow** or equivalent food waste tracking

---

## Key Numbers to Watch

| Metric | Current (May) | Target (Jun 2027) |
|--------|--------------|-------------------|
| Staff cost as % of revenue | 40% | **22%** |
| Average spend per guest | ~IDR 220K | **IDR 265K** |
| Guests per day | 56 | **82+** |
| AI tool investment | IDR 0 | IDR 350K-1.5M/month |
| GoFood commission cost | 20-30% of delivery | **IDR 15-25M saved** via direct ordering |
| Partnership EBITDA contribution | IDR 0 | **IDR 34-115M/month** |
| Management fee tax risk | IDR 6.25M/mo undocumented | **Formalized MSA needed** |

---

## Part O — Tax Loss Recovery Notes

A short reference tracking Rosalita's ~IDR 1.2B accumulated loss pool (worth ~IDR 260M in future tax savings at 22% CIT) and general Indonesian tax context. **[Previous draft's inter-company analysis has been removed — Rosalita, Red Ruby, and Island Bali Villas are not under common ownership.]** Available on the Tax Notes page.

---

## AI Tools — Start in 15 Minutes, All Free

| Tool | Cost | First Task |
|------|------|-----------|
| **ChatGPT** | Free | "Write 5 Instagram captions for Taco Tuesday" |
| **Canva** | Free | "Create Instagram story template for our promotions" |
| **Meta Business Suite** | Free | Link Instagram account, schedule this week's posts |

---

> **Bottom line**: The fundamentals work (May proved it). Execute the P0 list this week and P1 list this month, and Rosalita's goes from barely breaking even (**+IDR 434K/mo**) to generating **IDR 100-200M/month EBITDA** within 12 months. The cost-cutting alone gets you to IDR 101M. The AI tools, new hours, and partnerships push it higher.

*Full analysis: Parts A–N in the main Business Review. Part O (Tax Structure Analysis) available as a dedicated section. Live at rosalita-business-review.vercel.app*`;

export const KNOWLEDGE_SEED_SNIPPETS = [
  {
    key: 'executive_summary',
    category: 'document',
    content: EXECUTIVE_SUMMARY_FALLBACK,
  },
  {
    key: 'situation_summary',
    category: 'overview',
    content: `Rosalita Cantina is a Tex-Mex restaurant in Seminyak Square, Bali. After losing IDR 443 million in January-April 2026 due to staff costs at 54-68% of revenue (target: 22%), May 2026 was the first EBITDA-positive month at +IDR 434K. Staff was reduced from 34 to 22 people.`,
  },
  {
    key: 'five_levers',
    category: 'strategy',
    content: `The 12-month turnaround plan targets EBITDA growth through 5 levers: (1) Staff cost reduction to 22% of revenue, (2) Menu consolidation 60→48 items, (3) New revenue windows (Happy Hour, brunch), (4) AI automation, (5) Partnerships & Ecosystem Hub.`,
  },
  {
    key: 'may_2026_metrics',
    category: 'metrics',
    content: `May 2026 actuals: Revenue IDR 411M, EBITDA IDR 434K, 56 guests/day, IDR 220K avg spend, staff cost 40%, 22 staff.`,
  },
  {
    key: 'jun_2027_targets',
    category: 'metrics',
    content: `June 2027 targets — Conservative: IDR 615M/mo revenue, IDR 101M EBITDA; Realistic: IDR 699M, IDR 150M; Aspirational: IDR 819M, IDR 298M.`,
  },
  {
    key: 'priority_actions_p0',
    category: 'actions',
    content: `P0 this week: Create ChatGPT + Canva accounts, remove Asian Corner from all digital menus, fix Monday/Wednesday promos, check Red Ruby licensing, set up Prestix.vip profile.`,
  },
  {
    key: 'key_risks',
    category: 'risks',
    content: `Key risks: staff costs must stay under 22%, cocktail menu pricing gap, no POS item-level data yet, GoFood 20-30% commission, Asian Corner brand mismatch, tax loss carryforward IDR 1.1-1.2B expiring in 5 years.`,
  },
] as const;

export const MONTHLY_TARGETS_SEED = [
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
    'You are Rosalita AI — a business intelligence assistant for Rosalita Cantina, a Tex-Mex restaurant in Seminyak Square, Bali.',
    '',
    '## Your Role',
    'Help management understand the turnaround plan, track KPIs, analyze operational data, and provide actionable insights.',
  ];

  const categoryTitles: Record<string, string> = {
    overview: '## Key Business Situation',
    strategy: '## Turnaround Strategy',
    metrics: '## Metrics & Targets',
    actions: '## Priority Actions',
    risks: '## Key Risks to Monitor',
  };

  for (const [category, contents] of byCategory) {
    const title = categoryTitles[category] ?? `## ${category}`;
    sections.push('', title, contents.join('\n\n'));
  }

  const targetsBlock = MONTHLY_TARGETS_SEED.map(
    (t) => `- ${t.month}: Rev ${formatIdr(t.revenue)}, EBITDA ${formatIdr(t.ebitda)}, ${t.guests} guests/day`,
  ).join('\n');

  sections.push(
    '',
    '## Monthly Projection Targets',
    targetsBlock,
    '',
    '## How You Answer',
    '1. Cite specific Business Review parts when relevant.',
    '2. Use live database data for performance questions.',
    '3. Use IDR formatting (e.g., "IDR 150M").',
    '4. Be concise and data-driven.',
  );

  return sections.join('\n');
}
