/** Auto-generated review part fallbacks — do not edit manually. */
/** Regenerate: bun run scripts/generate-review-part-fallbacks.ts */

export interface ReviewPartFallback {
  slug: string;
  title: string;
  markdown: string;
}

export const REVIEW_PART_FALLBACKS: Record<string, ReviewPartFallback> = {
  'part-a': {
    slug: 'part-a',
    title: 'Part A: Current Situation — The Numbers',
    markdown: `## Part A: Current Situation — The Numbers

### A.1 Revenue Streams (Jan–Jun 2026)

Red Ruby operates two main revenue streams:

| Revenue Stream | Location | Hours | Revenue Model |
|---------------|----------|-------|---------------|
| **Club** | Main nightclub | Night operations | Beverage (65%), Tickets (25%), Shisha/Cigarettes (10%) |
| **Terrace 24h** | Outdoor terrace bar | 24/7 | Beverage (57%), Food (13%), Merchandise/Other (30%) |

### A.2 Monthly Revenue (Jan–Jun 2026)

| Month | Total Revenue (IDR) | COS | Gross Profit | Gross Margin | BEP Coverage |
|-------|-------------------|-----|-------------|-------------|--------------|
| Jan | 2,275,608,309 | 933,177,388 | 1,342,430,921 | 59.0% | 1.35x |
| Feb | 1,638,312,957 | 796,019,908 | 842,293,049 | 51.4% | 0.85x |
| Mar | 1,767,558,894 | 811,839,642 | 955,719,252 | 54.1% | 0.97x |
| Apr | 1,861,361,139 | 709,659,960 | 1,151,701,179 | 61.9% | 1.09x |
| May | 2,235,602,109 | 868,619,170 | 1,366,982,939 | 61.1% | 1.24x |
| Jun | 1,975,304,568 | 757,493,028 | 1,217,811,540 | 61.7% | 1.11x |

**Key insight**: The business has a seasonal pattern — Jan and May are strong months (above BEP comfortably), while Feb–Mar is Bali's low season (below or barely at BEP). April and June are transitional months.

### A.3 Cost Structure (May 2026)

| Category | Amount (IDR) | % of Revenue |
|----------|-------------|-------------|
| Purchases - Beverage | 400,060,612 | 17.9% |
| Purchases - Food & Other | 64,140,771 | 2.9% |
| Entertainment/Performers | 324,570,194 | 14.5% |
| Promoter Fees Internal | 38,314,879 | 1.7% |
| Promoter Fees Other | 16,942,523 | 0.8% |
| Other Direct Costs | — | 2.0% |
| **Total COS** | **868,619,170** | **38.8%** |
| Salaries & Wages | 616,978,740 | 27.6% |
| Operating Expenses | — | 7.8% |
| Sales & Marketing | — | 5.1% |
| Property Rents/R&M | — | 6.9% |
| Overhead & General | — | 4.8% |
| **Total Fixed** | **1,104,448,416** | **49.4%** |

### A.4 The Seasonal Challenge

| Period | Revenue | Fixed Costs | Monthly Surplus/Deficit |
|--------|---------|------------|------------------------|
| Jan (Peak) | IDR 2.28B | IDR 997M | +IDR 250M |
| Feb (Low) | IDR 1.64B | IDR 993M | -IDR 246M |
| Mar (Low) | IDR 1.77B | IDR 984M | -IDR 146M |
| Apr (Transition) | IDR 1.86B | IDR 1,055M | -IDR 87M |
| May (Peak) | IDR 2.24B | IDR 1,104M | +IDR 166M |

**The seasonal swing is IDR 636M between peak and trough revenue** (Jan vs Feb). Fixed costs remain stubbornly at IDR 950M–1.1B/month regardless of season.`,
  },

  'part-c': {
    slug: 'part-c',
    title: 'Part C: Revenue Optimization Strategy',
    markdown: `## Part C: Revenue Optimization Strategy

### C.1 Club Revenue (70% of total)

**Current**: 146-200 guests/night, IDR 400K-438K spend/guest
**Target (2027)**: 210 guests/night, IDR 420K spend/guest

Growth levers:
- **Ticket pricing**: Current average IDR 519M/month from ticket sales. Tiered pricing (early bird, standard, VIP, table service) can increase yield by 15-20%.
- **Table service**: Premium bottle service currently under-monetized. Target 5-10 VIP tables/night at IDR 3M-10M each.
- **Promoter/influencer ROI**: Currently spending IDR 55M/month on promoter fees. Track cost-per-guest and optimize channel mix.
- **Event calendar**: Weekly themed nights — measure which nights drive the highest margin guests.

### C.2 Terrace Revenue (20% of total)

**Current**: 50-80 guests/night, IDR 225K-270K spend/guest
**Target (2027)**: 85 guests/night, IDR 230K spend/guest

Growth levers:
- **Food menu optimization**: Current food purchases at IDR 64M/month (2.9% of revenue). Expand food offering as a traffic driver for daytime hours.
- **Shisha**: IDR 11.5M/month — explore premium shisha offerings at higher price points.
- **24-hour advantage**: The Terrace is the only 24h venue in the area. Market this aggressively.`,
  },
  'part-d': {
    slug: 'part-d',
    title: 'Part D: Cost Management',
    markdown: `## Part D: Cost Management

### D.1 Staff Optimization

| Period | Staff Count | Monthly Cost | % of Revenue |
|--------|------------|-------------|-------------|
| Jan-Apr 2026 | 80 | IDR 571M | 24.5-31.9% |
| May 2026 | 75 | IDR 545M | 26.1% |
| Jun 2026 | 73 | IDR 535M | 27.1% |
| 2027 Budget | 72 | IDR 558M | 15.9% |

**Key changes (Jan→Jun)**:
- Host/Floor/Waiter: 14→12 (saving IDR 10M/month)
- Marketing & GRO: 15→12 (saving IDR 13.5M/month)
- Security & Valet: 12→10 (saving IDR 9M/month)

### D.2 Staff Structure (73 FTE, IDR 6.58B/year)

| Department | Headcount | Annual Cost |
|-----------|-----------|-------------|
| Management | 4 | IDR 1,680M |
| Supervisor | 2 | IDR 360M |
| Admin/Cashier/Merchandiser | 6 | IDR 468M |
| Bar Staff | 10 | IDR 720M |
| Host/Floor/Waiter | 12 | IDR 760M |
| Marketing & GRO | 12 | IDR 702M |
| Kitchen | 7 | IDR 378M |
| Security & Valet | 10 | IDR 585M |
| Store/Cleaning | 6 | IDR 288M |
| Daily/Contract Worker | 4 | IDR 72M |
| Staff Travel/Meal/Medical | — | IDR 565M |
| **Total** | **73** | **IDR 6,578M** |

### D.3 Cost Control Priorities

- **Beverage**: 26% COS — explore bulk purchasing for top brands, implement inventory tracking
- **Entertainment**: IDR 325M/month (14.5%) — negotiate residency deals, develop in-house DJ roster
- **Property**: IDR 75M/month rent — locked at current rate through lease agreement`,
  },
  'part-e': {
    slug: 'part-e',
    title: 'Part E: Risk Register',
    markdown: `## Part E: Risk Register

| # | Risk | Likelihood | Impact | Mitigation |
|---|------|-----------|--------|------------|
| 1 | Seasonal revenue collapse (Jan-Mar low season) | High | High | Build IDR 500M+ cash reserves Oct-Dec; flex staffing down 20-30% in low season |
| 2 | Competition from new venues in Petitenget/Seminyak | Medium | Medium | Differentiate with 24h Terrace + StarWORLD loyalty program; invest in unique events |
| 3 | Regulatory/permitting risk (nightclub operating hours) | Medium | High | Maintain strong Banjar/community relationships; legal budget of IDR 80M/month for permits |
| 4 | Key staff turnover during scaling | Low-Med | Medium | Competitive above-market salaries; management bonus tied to EBITDA targets |
| 5 | Entertainment talent costs escalating | Medium | Medium | Develop in-house talent pipeline; 3-6 month residency contracts |
| 6 | Currency/exchange rate risk (USD-IDR) | Low | Low | Most revenue in IDR; StarWORLD USD revenue provides natural partial hedge |
`,
  },
  'part-f': {
    slug: 'part-f',
    title: 'Part F: StarWORLD Membership Program',
    markdown: `## Part F: StarWORLD Membership Program

The StarWORLD membership program creates recurring revenue and guest loyalty across 5 tiers:

| Tier | StarXP | Members (2026) | Annual Value (IDR) |
|------|--------|---------------|-------------------|
| Blue | 10 | 5,000 | 9.0B |
| Green | 100 | 4,000 | 72.0B |
| Gold | 500 | 950 | 85.5B |
| Platinum | 1,000 | 45 | 8.1B |
| Black/VVIP | 10,000 | 5 | 9.0B |
| **Total** | — | **10,000** | **183.6B** |

Membership benefits include priority entry, table reservations, drink discounts, and cross-venue access. Average member value: IDR 90 StarXP (USD $1,530/year).

The program targets 120,000 total members across all tiers, with a projected annual value of IDR 183.6B. The membership revenue model provides a stable recurring revenue base that offsets seasonal venue revenue fluctuations.`,
  },
  'part-g': {
    slug: 'part-g',
    title: 'Part G: Immediate Actions (Next 30 Days)',
    markdown: `## Part G: Immediate Actions (Next 30 Days)

| Priority | Action | Impact |
|----------|--------|--------|
| P0 | Build cash reserve to IDR 500M for seasonal coverage (Oct-Dec surplus allocation) | Protects against Jan-Feb losses |
| P0 | Finalize staff restructuring — target 73 FTE by July | Saves IDR 60M/month |
| P1 | Negotiate 3-6 month DJ/performer residencies | Reduces entertainment cost by 15-20% |
| P1 | Implement beverage inventory tracking system | Reduces wastage by 10% |
| P1 | Launch StarWORLD membership drive | Recurring revenue growth |

| P2 | Develop seasonal staffing model (high/low season templates) | Operational flexibility |`,
  },
};
