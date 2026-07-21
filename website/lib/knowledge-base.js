/**
 * Red Ruby Business Review — Knowledge Base
 * Used by /api/chat as the AI's system prompt context.
 * Contains key business data from the latest financial analysis.
 */

export const BUSINESS_NAME = 'Red Ruby Club & Terrace Bar';
export const LOCATION = 'PT Taman Bintang Bali, Petitenget, Bali, Indonesia';

export const SITUATION_SUMMARY = `
Red Ruby Club & Terrace Bar (PT Taman Bintang Bali) is under pressure financially and operationally. Revenue peaked in January 2026 at IDR 2.28B and has declined since — June was IDR 1.975B. Gross margins are critically below industry standard (51–62% observed vs 65–72% benchmark for nightclub operations). Entertainment costs run at 14.5% of revenue versus a 6–10% industry norm, consuming an estimated IDR 325M/month on talent. Supplier debt is increasing with no quantified ceiling. Guests are migrating to competing venues in Petitenget/Seminyak.

The MVP review commissioned by Graham Bristow is an exit viability assessment — not a growth strategy. Estimated exit pathways:
1. License + PT entity intact (other operators): IDR 8–15B
2. Related-party transfer (StarWORLD affiliate): IDR 5–10B
3. Management buyout with earn-out: IDR 3–8B
4. Liquidation (FF&E recovery only): IDR 1–3B

Exit window: approximately 60–90 days from July 2026. Beyond that, deteriorating financial signals reduce buyer interest and negotiating position significantly.
`;

export const CURRENT_METRICS = {
  june_2026: {
    revenue: 1_975_304_569, // IDR — declining from Jan peak
    ebitda: 114_000_000,
    ebitda_margin_pct: 5.8,
    gross_margin_pct: 61.7,
    cos_pct: 38.8,
    entertainment_pct: 14.5,
    staff_count: 73,
    assessment: 'declining — peaks do not exceed prior levels',
  },
  may_2026: {
    revenue: 2_235_602_109, // IDR — highest observed month this cycle
    ebitda: 166_480_378,
    ebitda_margin_pct: 7.5,
    gross_margin_pct: 61.1,
    cos_pct: 38.8,
    entertainment_pct: 14.5,
    staff_count: 73,
    assessment: 'only month with meaningful surplus; not enough to cushion troughs',
  },
};

export const EXIT_PATHWAYS = {
  pathway_1_license_entity: {
    name: 'Sell license + PT entity intact',
    buyer_type: 'Bali/Jakarta nightclub operator expanding',
    value_range: 'IDR 8–15B',
    conditions: '60-day financial clean-up, supplier negotiation for sell-side cooperation, FF&E inventory',
    viability: 'High — nightclub permits in Bali carry standalone scarcity value (est. IDR 2–5B)',
  },
  pathway_2_affiliate: {
    name: 'Transfer to StarWORLD affiliate',
    buyer_type: 'Related-party / affiliate company',
    value_range: 'IDR 5–10B',
    conditions: 'Transfer pricing documentation demonstrating fair market value',
    viability: 'Medium — constrained by arm\'s-length regulation; lower multiple expected',
  },
  pathway_3_management: {
    name: 'Management buyout with earn-out',
    buyer_type: 'Existing management team',
    value_range: 'IDR 3–8B',
    conditions: 'Supplier debt forgiveness upfront; management must prove funding capacity',
    viability: 'Lower base — requires supplier cooperation and management commitment',
  },
  pathway_4_liquidation: {
    name: 'Liquidation (last resort)',
    buyer_type: 'Multiple FF&E buyers + creditor settlements',
    value_range: 'IDR 1–3B',
    conditions: 'Asset sales, contract termination penalties, PT deregistration',
    viability: 'Worst case — only residual recovery after all obligations met',
  },
};

export const MONTHLY_TARGETS = [
  { month: '2026-07', revenue: 1_975_000_000, ebitda: 114_000_000, guests: 4_392, spend: 450_000, staffPct: 27 },
  { month: '2026-08', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_450, spend: 449_000, staffPct: 26 },
  { month: '2026-09', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_500, spend: 444_000, staffPct: 26 },
  { month: '2026-10', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_500, spend: 444_000, staffPct: 26 },
  { month: '2026-11', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_500, spend: 444_000, staffPct: 26 },
  { month: '2026-12', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_500, spend: 444_000, staffPct: 26 },
  { month: '2027-01', revenue: 2_000_000_000, ebitda: 100_000_000, guests: 4_500, spend: 444_000, staffPct: 26 },
  { month: '2027-02', revenue: 1_800_000_000, ebitda: 50_000_000, guests: 4_000, spend: 450_000, staffPct: 25 },
  { month: '2027-03', revenue: 1_800_000_000, ebitda: 50_000_000, guests: 4_000, spend: 450_000, staffPct: 25 },
  { month: '2027-04', revenue: 1_800_000_000, ebitda: 50_000_000, guests: 4_000, spend: 450_000, staffPct: 25 },
  { month: '2027-05', revenue: 1_800_000_000, ebitda: 50_000_000, guests: 4_000, spend: 450_000, staffPct: 25 },
  { month: '2027-06', revenue: 1_800_000_000, ebitda: 50_000_000, guests: 4_000, spend: 450_000, staffPct: 25 },
];

/** Exit-viability levers — replace the old "turnaround levers" that assumed growth was possible. */
export const EXIT_LEVERS = [
  {
    num: 1,
    name: 'Entertainment cost reduction',
    impact: '~IDR 100–125M/month savings',
    target: 'Reduce entertainment from IDR 325M to IDR 180–200M/month (≤9% of revenue)',
    actions: [
      'Convert per-night talent contracts to 3-month residency deals at lower rates',
      'Retain only acts that drive observable attendance lift (verified by Lukas POS data)',
      'Eliminate international/international-level headliners above IDR 25M/night unless proven ROI',
      'Build in-house DJ roster as primary drawcard rather than expensive visiting acts',
    ],
  },
  {
    num: 2,
    name: 'Operational cost freeze + FF&E catalog for sale',
    impact: '~IDR 75–125M/month savings; IDR 520–1,255M asset recovery potential',
    target: 'Fixed costs to IDR ~900M/month from current ~IDR 1,050M',
    actions: [
      'Eliminate all non-essential OPE (marketing materials, maintenance contractors)',
      'Reduce promoter fee pool by 30% — pay only promoters with proven attendance attribution',
      'Catalog FF&E with market resale estimates from 3 vendors per category',
      'Negotiate partial settlement or novation agreements with top-5 suppliers for sell-side cooperation',
    ],
  },
  {
    num: 3,
    name: 'Financial clean-up for sell-side due diligence',
    impact: 'Increases valuation by making the entity transferable rather than distressed',
    target: 'Amalgamate all data into clean books snapshot within 8 weeks',
    actions: [
      'Produce supplier aging report + inter-company reconciliation (Ama)',
      'Confirm permit transferability to new PT (Made)',
      'Obtain Tax Clearance Certificate (SKPKB) for share transfer at Bapenbenda',
      'Calculate floor price = asset recovery value + license value − liabilities − taxes',
    ],
  },
  {
    num: 4,
    name: 'Buyer identification and engagement',
    impact: 'Determines actual realized value vs. theoretical ceiling',
    target: 'LOIs from 2+ qualified buyers within 60 days of clean books completion',
    actions: [
      'Identify 3–5 likely buyers: other Bali operators, regional entrants, StarWORLD affiliate',
      'Engage Bali-based F&B/entertainment business broker (optional but recommended)',
      'Prepare confidentiality agreement + data room access protocol for buyer diligence',
      'Set floor price before any discussions — minimum acceptable offer must be fixed',
    ],
  },
];

// Compat alias for consumers that still import FIVE_LEVERS by name (seed, lever accordion etc.)
export const FIVE_LEVERS = EXIT_LEVERS;

export const PRIORITY_ACTIONS = {
  // Backward-compatible aliases used by seed-runner.ts buildKnowledgeSnippets()/buildActionItems()
  P0_THIS_WEEK: [
    'Graham: set floor price with Ama (liabilities + capital contribution)',
    'Lukas: implement operational cost freeze to IDR ~900M/month floor',
    'James: convert highest-cost talent contracts to residencies',
    'Lukas: stop ghost promoter spending — audit fee payouts vs. POS attributed guests',
    'Ama: begin supplier aging report for top-5 vendors by volume and debt',
  ],
  P1_THIS_MONTH: [
    'Ama: complete inter-company reconciliation (Red Ruby ↔ StarWORLD flow)',
    'Made: confirm PT share transferability + permit transfer rules with Denpasar office',
    'Lukas: catalogue full FF&E inventory with market resale estimates',
    'James: cut entertainment spend to ≤IDR 180M/month via residency roster',
    'Lukas + Made: negotiate extended supplier terms for sell-side cooperation window',
  ],
  P2_THIS_QUARTER: [
    'Ama: model worst-case liquidity stress test (cash runway under 3 scenarios)',
    'Made: survey all supplier contract exit/novation terms — what can be novated to buyer?',
    'All: assemble sell-side clean books package (P&L, balance sheet, license transfer docs)',
    'Graham: engage with identified 3–5 buyer leads',
    'Ama + Graham: finalize floor price before any buyer discussions begin',
  ],
  P0_IMMEDIATE: [
    'Graham: set floor price with Ama (liabilities + capital contribution)',
    'Lukas: implement operational cost freeze to IDR ~900M/month floor',
    'James: convert highest-cost talent contracts to residencies',
    'Lukas: stop ghost promoter spending — audit fee payouts vs. POS attributed guests',
    'Ama: begin supplier aging report for top-5 vendors by volume and debt',
  ],
  P1_2_WEEKS: [
    'Ama: complete inter-company reconciliation (Red Ruby ↔ StarWORLD flow)',
    'Made: confirm PT share transferability + permit transfer rules with Denpasar office',
    'Lukas: catalogue full FF&E inventory with market resale estimates',
    'James: cut entertainment spend to ≤IDR 180M/month via residency roster',
    'Lukas + Made: negotiate extended supplier terms for sell-side cooperation window',
  ],
  P2_6_WEEKS: [
    'Ama: model worst-case liquidity stress test (cash runway under 3 scenarios)',
    'Made: survey all supplier contract exit/novation terms — what can be novated to buyer?',
    'All: assemble sell-side clean books package (P&L, balance sheet, license transfer docs)',
    'Graham: engage with identified 3–5 buyer leads',
    'Ama + Graham: finalize floor price before any buyer discussions begin',
  ],
};

export const KEY_RISKS = [
  'Exit window closing: approximately 60–90 days from July 2026 — beyond that, declining financial signals eliminate buyer interest and negotiating position',
  'Gross margins at 51–62% vs. industry standard 65–72% — indicates structural cost failure Ama must audit immediately',
  'Entertainment spending at 14.5% of revenue (IDR 325M/month) creates a margin death spiral when combined with declining attendance',
  'Supplier debt trend unknown magnitude but "increasing" per commission letter — creditors may call invoices at any time, causing liquidity crisis',
  '"Money leaking" source unidentified — potential staff shrinkage, inter-company charges, or over-pouring require forensic reconciliation before buyer engagement',
  'Guest leakage to Petitenget/Seminyak competitors requires Lukas + James data analysis to determine if operational attrition is survivable post-transfer',
];

export const EXIT_RISK_ASSESSMENT = {
  worst_case: 'Supplier calls all outstanding invoices within 30 days → cash runway depleted before any buyer can close. Liquidation becomes only option.',
  high_risk_window: 'If liquidity stress test shows < 60 days of runway, pathway compression to 30-day urgency applies — all actions must accelerate.',
  key_dependency: 'Permit transferability (Made\'s Week 1–2 confirmation) determines whether Pathways 1 and 2 are viable. If permits don\'t transfer, valuation drops 40–60%.',
};

// Kept for seed-runner.ts buildKnowledgeSnippets() compatibility
export const STRATEGIC_PARTNERSHIPS = {
  red_ruby: { name: 'Red Ruby Bali', type: '24/7 nightclub', opportunity: 'Exit viability context', revenue_impact: '' },
  industry_events: { name: 'Exit pathways', type: 'License transfer, buyout, liquidation', opportunity: 'Graham Bristow exit window', revenue_impact: '' },
};

export const TARGET_METRICS = {};

/**
 * Task playbook — comprehensive description + step-by-step instructions for each
 * priority action. Keyed by a normalized task title (lowercased, trimmed).
 * Consumed by seed-runner.ts buildTasks() to populate Task.description.
 */
export const TASK_PLAYBOOK = {
  'set floor price with ama (liabilities + capital contribution)': {
    description:
      'Establish the minimum acceptable sale price before any buyer conversation begins. The floor price protects Graham and the StarWORLD/Bristow share from distressed undervaluation during the 60–90 day exit window.',
    steps: [
      'Ama compiles the full liabilities schedule: supplier debt, accrued wages, taxes payable, related-party balances.',
      'Ama documents the capital contribution ledger (cash + in-kind) from StarWORLD/Bristow into PT Taman Bintang Bali.',
      'Graham and Ama agree the floor = asset recovery value (FF&E + license) − total liabilities − expected taxes on sale.',
      'Record the agreed floor price in the sell-side data room and circulate to all stakeholders. No offer below this number is entertained.',
    ],
  },
  'implement operational cost freeze to idr ~900m/month floor': {
    description:
      'Freeze all non-essential operating expenditure to bring the fixed-cost base from ~IDR 1,050M/month down to ~IDR 900M/month. This is the single fastest lever to extend cash runway and improve exit attractiveness.',
    steps: [
      'Freeze all marketing material production, discretionary maintenance contractors, and new capex.',
      'Reduce the promoter fee pool by 30% — pay only promoters with verified attendance attribution.',
      'Pause any new hiring; manage attrition through natural vacancy.',
      'Track weekly actual spend vs the IDR 900M ceiling; flag any line exceeding 95% of budget.',
      'Report the weekly run-rate to Graham and Lukas until the floor is sustained for 4 consecutive weeks.',
    ],
  },
  'convert highest-cost talent contracts to residencies': {
    description:
      'Replace per-night headline talent contracts (especially any above IDR 25M/night) with 3-month residency deals at materially lower rates. Cuts entertainment spend toward the ≤9% of revenue target.',
    steps: [
      'List all talent contracts by cost-per-night; flag those above IDR 25M/night.',
      'Approach each flagged act with a 3-month residency proposal at a reduced fixed fee.',
      'For acts that decline, remove from the calendar and reallocate the slot to the in-house DJ roster.',
      'Confirm new residency rates bring monthly entertainment to ≤IDR 180M.',
      'Keep only acts that Lukas POS data shows drive a measurable attendance lift.',
    ],
  },
  'stop ghost promoter spending — audit fee payouts vs. pos attributed guests': {
    description:
      'Eliminate promoter payments that cannot be tied to actual guest attribution. "Ghost" promoter spend is a primary leak draining margin with no return.',
    steps: [
      'Export the last 90 days of promoter fee payouts with the attributed guest counts claimed by each promoter.',
      'Pull POS guest counts by referral source for the same period from Lukas\'s data.',
      'Reconcile: any promoter whose claimed attribution exceeds POS-attributed guests by >15% is flagged.',
      'Suspend payment to flagged promoters pending explanation; require unique referral codes going forward.',
      'Pay only promoters whose attributed guests reconcile to POS within tolerance.',
    ],
  },
  'begin supplier aging report for top-5 vendors by volume and debt': {
    description:
      'Build a supplier aging report covering the top-5 vendors by both spend volume and outstanding debt. This is the foundation for the sell-side clean books and for negotiating cooperative terms with buyers.',
    steps: [
      'Ama extracts all AP balances from the ledger, grouped by vendor.',
      'Rank vendors by (a) trailing-12-month spend and (b) current outstanding balance; take the union of the top-5 in each.',
      'For each vendor, age the debt into 0–30 / 31–60 / 61–90 / 90+ day buckets.',
      'Flag any vendor with 90+ day exposure as a liquidity risk to be addressed before buyer engagement.',
      'Publish the aging report to the sell-side data room.',
    ],
  },
  'complete inter-company reconciliation (red ruby ↔ starworld flow)': {
    description:
      'Reconcile all flows between Red Ruby (PT Taman Bintang Bali) and StarWORLD affiliates. Unreconciled inter-company balances are a red flag for buyers and tax authorities during share transfer.',
    steps: [
      'Ama pulls every inter-company journal entry for the trailing 24 months.',
      'Match each Red Ruby debit/credit to the corresponding StarWORLD entry; resolve timing and FX differences.',
      'Identify any unmatched balances and obtain confirming statements from StarWORLD.',
      'Produce a net inter-company position statement signed by both entities\' finance leads.',
      'Attach the reconciliation to the clean books package.',
    ],
  },
  'confirm pt share transferability + permit transfer rules with denpasar office': {
    description:
      'Verify whether the PT shares and the nightclub operating permits can be transferred to a new owner, and under what rules. Permit transferability determines whether Exit Pathways 1 and 2 are viable (a "no" drops valuation 40–60%).',
    steps: [
      'Made reviews the PT articles and the license conditions for transfer restrictions.',
      'Contact the Denpasar BKPM / licensing office to confirm the permit transfer procedure and required documents.',
      'Confirm whether a share transfer (not asset sale) preserves the existing permits.',
      'Document the answer with the office reference and any conditions (e.g., tax clearance).',
      'If permits do NOT transfer, escalate to Graham immediately — this compresses the exit pathway.',
    ],
  },
  'catalogue full ff&e inventory with market resale estimates': {
    description:
      'Catalogue all furniture, fixtures & equipment with independent market resale estimates from three vendors per category. Establishes the asset-recovery floor used in the floor-price calculation.',
    steps: [
      'Lukas lists every FF&E asset by category, location, and condition.',
      'Engage 3 resale vendors per major category (audio, lighting, furniture, bar) for written estimates.',
      'Record the midpoint estimate per asset; total the recoverable value.',
      'Photograph high-value items and store in the data room.',
      'Reconcile the FF&E total into the floor-price asset-recovery figure.',
    ],
  },
  'cut entertainment spend to ≤idr 180m/month via residency roster': {
    description:
      'Sustain the entertainment cost reduction achieved in P0 by locking in the residency roster and confirming monthly spend stays at or below IDR 180M (≤9% of revenue).',
    steps: [
      'Confirm all residency contracts are signed and effective.',
      'Monitor weekly entertainment accruals; alert if the run-rate exceeds IDR 180M.',
      'Retire any remaining per-night headline acts above the threshold.',
      'Report the sustained monthly figure to Graham and Ama.',
    ],
  },
  'negotiate extended supplier terms for sell-side cooperation window': {
    description:
      'Secure extended payment terms from top suppliers so the entity remains solvent and cooperative through the sale process. Suppliers who believe they will be paid are far more likely to support a smooth transfer.',
    steps: [
      'Lukas + Made approach the top-5 suppliers with the aging report context.',
      'Propose a term extension (e.g., 60→90 days) in exchange for a written commitment to pay from sale proceeds.',
      'Document any novation or partial-settlement agreement that can transfer to the buyer.',
      'Record signed term extensions in the data room.',
    ],
  },
  'model worst-case liquidity stress test (cash runway under 3 scenarios)': {
    description:
      'Model cash runway under three scenarios (base, downside, severe) to know exactly how many days of runway remain. If runway drops below 60 days, the exit window compresses to 30-day urgency.',
    steps: [
      'Ama builds a 13-week cash-flow model with the IDR 900M cost floor.',
      'Run base (no new shock), downside (one major supplier calls debt), severe (multiple creditors + revenue drop).',
      'Compute days-of-runway for each scenario.',
      'If any scenario < 60 days, trigger the accelerated 30-day urgency plan and notify Graham.',
      'Update the model weekly with actuals.',
    ],
  },
  'survey all supplier contract exit/novation terms — what can be novated to buyer?': {
    description:
      'Determine which supplier contracts can be novated (transferred) to the buyer versus which must be terminated. Novatable contracts increase the entity\'s transferability and reduce buyer friction.',
    steps: [
      'Made reviews each top supplier contract for assignment/novation clauses.',
      'Classify each as: novatable, terminable, or locked (requires consent).',
      'For locked contracts, identify the consent process and likely cost.',
      'Summarize the novation map for the buyer data room.',
    ],
  },
  'assemble sell-side clean books package (p&l, balance sheet, license transfer docs)': {
    description:
      'Produce the complete sell-side information package: clean P&L, balance sheet, and all license-transfer documentation. This is what buyers and their advisors review during due diligence.',
    steps: [
      'Consolidate the reconciled P&L and balance sheet (Ama).',
      'Attach the permit transfer confirmation and tax clearance certificate (Made).',
      'Include the FF&E recovery valuation and floor-price memo (Lukas + Graham).',
      'Add the liquidity stress test and supplier novation map.',
      'All: review the package for consistency; lock it in the data room before any LOI.',
    ],
  },
  'engage with identified 3–5 buyer leads': {
    description:
      'Initiate confidential conversations with 3–5 qualified buyer leads (Bali/Jakarta operators, regional entrants, StarWORLD affiliate). Goal: LOIs from 2+ buyers within 60 days of clean books.',
    steps: [
      'Graham qualifies each lead against the buyer criteria (capital, intent, license need).',
      'Issue a teaser + NDA; grant data-room access only after NDA signature.',
      'Run a light process: management call → data room → indication of interest.',
      'Track each lead\'s stage and target 2+ LOIs post clean-books.',
      'Keep the floor price fixed; do not negotiate below it.',
    ],
  },
  'finalize floor price before any buyer discussions begin': {
    description:
      'Lock the final floor price with Ama and Graham before any buyer discussion. This prevents anchoring low and protects the Bristow share from a distressed sale.',
    steps: [
      'Ama + Graham review the assembled clean books and asset-recovery valuation.',
      'Confirm the floor = asset recovery + license value − liabilities − taxes.',
      'Sign off the final floor price; circulate to all deal team members.',
      'No offer below the floor is presented to Graham for consideration.',
    ],
  },
};

// Kept for seed-runner.ts buildActionItems() compatibility
export function buildActionItems() { return []; }

export function buildSystemPrompt() {
  const pathwaysStr = Object.entries(EXIT_PATHWAYS)
    .map(([k, p]) => `${k}: ${p.name} → ${p.value_range} — ${p.conditions}`)
    .join('\n');

  return `You are Red Ruby AI — a business intelligence assistant for Red Ruby Club & Terrace Bar, PT Taman Bintang Bali in Petitenget, Bali.

## Critical Context: Exit Viability (July 2026)

${SITUATION_SUMMARY}

## Current Metrics

- June 2026: Revenue ${formatIDR(CURRENT_METRICS.june_2026.revenue)}, EBITDA ${formatIDR(CURRENT_METRICS.june_2026.ebitda)}, Gross Margin ${CURRENT_METRICS.june_2026.gross_margin_pct}%, COS ${CURRENT_METRICS.june_2026.cos_pct}%, Entertainment 14.5%
- May 2026 (peak this cycle): Revenue ${formatIDR(CURRENT_METRICS.may_2026.revenue)}, EBITDA ${formatIDR(CURRENT_METRICS.may_2026.ebitda)}, Gross Margin ${CURRENT_METRICS.may_2026.gross_margin_pct}%
- Assessment: Declining trajectory with structural cost failure — gross margin critically below 65–72% industry standard for nightclub operations

## Exit Pathways (Ranked)

${pathwaysStr}

## Exit Levers (Highest Impact First)

${EXIT_LEVERS.map(l => `${l.num}. ${l.name}: ${l.impact} → target: ${l.target}`).join('\n')}

## Monthly Run-Rate Targets (Conservative — Assumes No Revenue Growth, Only Cost Reduction)

${MONTHLY_TARGETS.map(t => `- ${t.month}: Rev ${formatIDR(t.revenue)}, EBITDA ${formatIDR(t.ebitda)}, ${t.guests} guests, spend ${formatIDR(t.spend)}, staff ${t.staffPct}%`).join('\n')}

## Priority Actions
P0 (Immediate): ${PRIORITY_ACTIONS.P0_IMMEDIATE.join(' · ')}
P1 (2 Weeks): ${PRIORITY_ACTIONS.P1_2_WEEKS.join(' · ')}
P2 (6 Weeks): ${PRIORITY_ACTIONS.P2_6_WEEKS.join(' · ')}

## Key Risks to Monitor
${KEY_RISKS.map(r => `- ${r}`).join('\n')}

## Exit Risk Summary
- Worst case: Supplier calls all invoices within 30 days → cash runway depleted → liquidation only option
- High risk window: If liquidity stress test shows < 60 days of runway, accelerate to 30-day urgency
- Key dependency: Permit transferability determines whether Pathways 1 and 2 are viable

## How You Answer
1. **Exit viability questions**: Answer from this knowledge base — cite specific exit pathway (Pathway 1–4), lever number, and stakeholder action when relevant.
2. **Performance analysis**: When asked about actual performance or KPIs, query the live database and compare against conservative run-rate targets above.
3. **Data queries**: I can fetch daily metrics, compare actuals vs monthly targets, show trends, and highlight areas needing attention.
4. **Always be concise and data-driven**. Use IDR formatting (e.g., "IDR 8–15B"). Reference specific levers and pathways when advising on exit decisions.
5. Do NOT advise growth strategies — this is an exit scenario. Redirect any growth-oriented questions to the reality of the current mandate.

Keep responses conversational but anchored in the data above. When showing numbers, put them in context of the 60–90 day exit window.`;
}

function formatIDR(n) {
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000) return `IDR ${(n / 1_000).toFixed(0)}K`;
  return `IDR ${n}`;
}
