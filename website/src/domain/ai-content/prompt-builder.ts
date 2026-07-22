/**
 * Prompt Builder
 *
 * Takes extracted Excel data and builds a comprehensive system prompt
 * that instructs the AI to generate:
 *   1. Business Review (Markdown) — multi-part exit-viability review with data tables
 *   2. Executive Summary (Markdown) — exit diagnostics assessment
 *
 * The prompt includes ALL financial data inline so the AI has full context.
 */

import type { ExcelData, PlLine, BepMonthlyRow, MonthOnMonthLine } from '@/domain/excel/excel-extractor';

// ── Formatting helpers ──────────────────────────────────

function fmtIdr(n: number): string {
  if (n >= 1_000_000_000) return `IDR ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `IDR ${(n / 1_000_000).toLocaleString('id-ID')}`;
  if (n >= 1_000) return `IDR ${(n / 1_000).toFixed(0)}K`;
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function fmtIdrExact(n: number): string {
  return `IDR ${Math.round(n).toLocaleString('id-ID')}`;
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

// ── Section builders ────────────────────────────────────

function buildCompanyInfoSection(data: ExcelData): string {
  return [
    `## Company Information`,
    `- **Company**: ${data.company}`,
    `- **Period**: ${data.period}`,
    `- **Workbook**: ${data.workbookName}`,
    ``,
    `Red Ruby Club & Terrace Bar is a nightclub and bar in Petitenget, Seminyak, Bali.`,
    `It operates two main revenue streams: Club (nightclub) and Terrace 24h (outdoor bar).`,
  ].join('\n');
}

function buildProfitAndLossSection(lines: PlLine[]): string {
  if (!lines.length) return '';
  const tableRows = lines.map(
    (l) => `| ${l.accountCode} | ${l.description} | ${fmtIdrExact(l.amount)} |`,
  );
  return [
    `## Profit & Loss — June 2026`,
    ``,
    `| Account | Description | Amount (IDR) |`,
    `|---------|-------------|-------------|`,
    ...tableRows,
    ``,
  ].join('\n');
}

function buildBepSection(rows: BepMonthlyRow[]): string {
  if (!rows.length) return '';
  const tableRows = rows.map(
    (r) => `| ${r.period} | ${fmtIdrExact(r.totalRevenue)} | ${fmtIdrExact(r.totalCos)} | ${fmtPct(r.grossMarginPct)} | ${fmtIdrExact(r.totalFixedCost)} | ${fmtIdrExact(r.bepRevenue)} | ${r.bepCoverage.toFixed(2)}x |`,
  );
  return [
    `## Break-Even Point Analysis (Monthly)`,
    ``,
    `| Period | Revenue | COS | Gross Margin | Fixed Cost | BEP Revenue | BEP Coverage |
|--------|---------|-----|-------------|-----------|-------------|--------------|
${tableRows.join('\n')}`,
    ``,
  ].join('\n');
}

function buildMonthOnMonthSection(lines: MonthOnMonthLine[]): string {
  if (!lines.length) return '';
  const tableRows = lines.map(
    (l) => `| ${l.description} | ${fmtIdrExact(l.previousMonth)} | ${fmtIdrExact(l.currentMonth)} | ${(l.changePct * 100).toFixed(1)}% |`,
  );
  return [
    `## Month-on-Month Comparison (Previous Month vs June 2026)`,
    ``,
    `| Description | Previous Month | Current Month | Change |
|-------------|---------------|--------------|--------|
${tableRows.join('\n')}`,
    ``,
  ].join('\n');
}

function buildMonthlyVarianceSection(data: ExcelData): string {
  const rows = data.monthlyVariance;
  if (!rows.length) return '';
  const tableRows = rows.map(
    (r) => `| ${r.item} | ${fmtIdrExact(r.mayValue)} | ${fmtIdrExact(r.juneValue)} | ${fmtIdrExact(r.variance)} | ${(r.variancePct * 100).toFixed(1)}% |`,
  );
  return [
    `## Monthly Variance (May 2026 vs June 2026)`,
    ``,
    `| Item | May 2026 | June 2026 | Variance | Variance % |
|------|---------|----------|---------|-----------|
${tableRows.join('\n')}`,
    ``,
  ].join('\n');
}

function buildDailySalesSection(data: ExcelData): string {
  const ds = data.dailySales;
  const terraceTotal = Object.values(ds.totals).reduce((a, b) => a + b, 0);
  const avgSpend = Object.values(ds.spendPerGuest).filter((v) => v > 0);
  const avgSpendValue = avgSpend.length ? avgSpend.reduce((a, b) => a + b, 0) / avgSpend.length : 0;

  return [
    `## Daily Sales Summary`,
    ``,
    `### Terrace Revenue`,
    `- **Total Terrace Revenue for month**: ${fmtIdrExact(terraceTotal)}`,
    ds.terraceRevenue.length ? ds.terraceRevenue.map(
      (r) => `- **${r.description}**: ${fmtIdrExact(Object.values(r.dailyValues).reduce((a, b) => a + b, 0))}`,
    ).join('\n') : '- No detailed data',
    ``,
    `### Club Revenue`,
    ds.clubRevenue.length ? ds.clubRevenue.map(
      (r) => `- **${r.description}**: ${fmtIdrExact(Object.values(r.dailyValues).reduce((a, b) => a + b, 0))}`,
    ).join('\n') : '- No detailed data',
    ``,
    `### Spend per Guest (daily average): ${fmtIdrExact(Math.round(avgSpendValue))}`,
    ``,
  ].join('\n');
}

function buildSummaryPlSection(data: ExcelData): string {
  if (!data.summaryPl.length) return '';
  const sections = data.summaryPl.map((year) => {
    const lines = year.lines.map(
      (l) => `| ${l.description} | ${fmtIdrExact(l.amount)} |`,
    );
    return [
      `### ${year.year}`,
      `| Description | Amount |
|-------------|--------|
${lines.join('\n')}`,
    ].join('\n');
  });
  return [
    `## Multi-Year P&L Summary`,
    ``,
    sections.join('\n\n'),
    ``,
  ].join('\n');
}

function buildBalanceSheetSection(data: ExcelData): string {
  if (!data.balanceSheet.length) return '';
  const rows = data.balanceSheet.map(
    (l) => `| ${l.description} | ${fmtIdrExact(l.amount)} |`,
  );
  return [
    `## Balance Sheet — June 2026`,
    ``,
    `| Description | Amount |
|-------------|--------|
${rows.join('\n')}`,
    ``,
  ].join('\n');
}

// ── Main prompt builder ─────────────────────────────────

export function buildGenerationPrompt(data: ExcelData, additionalContext?: string): string {
  const sections: string[] = [
    `# Red Ruby Financial Analysis — AI Content Generation Prompt`,
    ``,
    `You are a financial analyst and business writer for Red Ruby Club & Terrace Bar (PT Taman Bintang Bali) in Petitenget, Bali.`,
    `Your task is to generate TWO documents based EXCLUSIVELY on the financial data provided below.`,
    ``,
    `This is NOT a growth review. This is an EXIT VIABILITY ASSESSMENT. The shareholder (Graham Bristow) wants to sell their stake in PT Taman Bintang Bali (Red Ruby). Everything you generate must be framed around two questions:`,
    ``,
    `1. Why is Red Ruby in trouble?`,
    `2. What value can the shareholder extract, and through what pathway, given the current condition?`,
    ``,
    `## CRITICAL OUTPUT INSTRUCTIONS`,
    ``,
    `You MUST respond with a valid JSON object containing exactly two keys: "businessReview" and "executiveSummary".`,
    `Do NOT include any text outside the JSON object. The JSON must be parseable.`,
    ``,
    `### Output Format`,
    `\`\`\`json`,
    `{`,
    `  "businessReview": "# Red Ruby Club & Terrace Bar — Business Review\\n\\n## Part A: Current Situation...",`,
    `  "executiveSummary": "# Red Ruby Club & Terrace Bar — Executive Summary (Exit Viability)\\n\\n## The Appointment...",`,
    `}`,
    `\`\`\``,
    ``,
    `### Business Review Requirements`,
    `Generate a comprehensive multi-part business review in Markdown with the following structure:`,
    ``,
    `- **Part A: Current Situation — The Numbers** — Revenue streams, monthly revenue table (Jan-Jun 2026 from BEP data), cost structure, seasonal challenge analysis`,
    `- **Part B: The 10-Year Growth Model** — Revenue growth trajectory table (2026-2035), profitability progression (EBITDA margin improving from 8.6% to 29.5%)`,
    `- **Part C: Revenue Optimization Strategy** — Club revenue (70% of total) with per-guest spend, Terrace revenue (20% of total), Sky Lounge launch (2029)`,
    `- **Part D: Cost Management** — Staff optimization (80->73 FTE), beverage cost control, entertainment cost reduction (14.5% -> 8% of revenue)`,
    `- **Part E: Risk Register** — Table of 6-8 risks with likelihood, impact, and mitigation strategies`,
    `- **Part F: StarWORLD Membership Program** — 5 tiers (Blue/Green/Gold/Platinum/Black), 10,000 members, IDR 183.6B total program value`,
    `- **Part G: Immediate Actions (Next 30 Days)** — Priority table (P0/P1/P2) with actions, owner, impact`,
    ``,
    `Each part should include data tables formatted in Markdown. Use IDR formatting (e.g., "IDR 1.98B"). Include percentage calculations where relevant.`,
    `Write in a professional, analytical tone. Base all numbers on the data provided.`,
    ``,
    `### Executive Summary Requirements`,
    `Generate the Executive Summary as a formal exit-viability assessment document in Markdown with the following structure:`,
    ``,
    `- **The Appointment — Restated Mandate** — Graham Bristow's commission: the business is under financial pressure, revenues dropping, margins eroding, supplier debt increasing, guests choosing other venues. This is an exit viability assessment.`,
    ``,
    `- **Part I — What's Wrong (The Diagnostic)** — Cover each of these subsections:`,
    `  - D.1 Revenue Trend — Confirmed decline using monthly revenue table from BEP data`,
    `  - D.2 Gross Margin Erosion — Monthly gross margin table showing 51-62% range vs industry norm of 65-72%`,
    `  - D.3 Supplier Debt — Accumulating liability, risk of supplier leverage collapse`,
    `  - D.4 "Money Leaking" — Unquantified loss vectors: staff shrinkage, ghost promoters, inventory variance, inter-company charges`,
    `  - D.5 Competitive Leakage — Guest density decline, Terrace 24h advantage being neutralized`,
    ``,
    `- **Part II — What It Costs to Wait** — Monthly cash burn during low season (Feb-Mar losses of ~IDR 300M), supplier debt accrual rate estimate`,
    ``,
    `- **Part III — Valuation Implications for the Share Sale** — What Graham brings to market (licenses, assets, team), valuation approaches (asset-based, license transfer, recovery sale), the "Clean-Up Window" (60-90 days), recommended exit pathway ranked by priority (1-4)`,
    ``,
    `- **Part IV — Critical Actions by Stakeholder** — Action tables for each stakeholder with numbered actions, owner, deadline:`,
    `  - A. Ama (Financial) — supplier aging, cash reconciliation, liquidity model, sell-side books`,
    `  - B. Made (Compliance & Legal) — PT ownership, license transferability, inter-company transactions, severance liability`,
    `  - C. Lukas (Operational & Promoters) — ghost promoter audit, cost freeze, supplier negotiation, asset inventory`,
    `  - D. James (Music & DJs) — entitlement review, in-house talent pipeline, lineup cost analysis`,
    `  - E. Graham Bristow (Shareholder) — floor price determination, buyer identification, broker engagement`,
    ``,
    `- **Part V — The Pathway Summary** — ASCII diagram or flow chart showing current state -> 60-90 day window -> clean-up financials -> target buyer list -> close sale at floor price -> expected IDR 8-15B outcome`,
    ``,
    `Keep the executive summary comprehensive (2-4 pages when rendered). Use clear section headers and data tables. The tone must be diagnostic and valuation-focused, not promotional.`,
    ``,
    `## SOURCE DATA — USE THIS DATA ONLY`,
    ``,
  ];

  // Append all data sections
  sections.push(buildCompanyInfoSection(data));
  sections.push(buildProfitAndLossSection(data.profitAndLoss));
  sections.push(buildBalanceSheetSection(data));
  sections.push(buildBepSection(data.bepMonthly));
  sections.push(buildMonthOnMonthSection(data.monthOnMonth));
  sections.push(buildMonthlyVarianceSection(data));
  sections.push(buildDailySalesSection(data));
  sections.push(buildSummaryPlSection(data));

  // Append additional context from AI Findings (if provided by user selection)
  if (additionalContext) {
    sections.push('');
    sections.push('## Additional Context — AI Findings');
    sections.push('The following insights were flagged by management during AI chat sessions. Incorporate this information into the review where relevant:');
    sections.push('');
    sections.push(additionalContext);
    sections.push('');
  }

  // Close with final reminder
  sections.push(``);
  sections.push(`## Final Reminder`);
  sections.push(`Return ONLY a JSON object with "businessReview" and "executiveSummary" keys.`);
  sections.push(`Both values must be valid Markdown strings.`);
  sections.push(`Use proper Markdown tables, headers, and formatting.`);
  sections.push(`Base ALL numbers and analysis on the data provided above. Do not fabricate data.`);
  sections.push(``);

  return sections.join('\n');
}

/**
 * Build a human-readable summary of the extracted data for the admin UI.
 */
export function buildDataSummary(data: ExcelData): string {
  const lines: string[] = [
    `**Workbook**: ${data.workbookName}`,
    `**Period**: ${data.period}`,
    `**Company**: ${data.company}`,
    ``,
    `**Data Extracted**:`,
  ];

  if (data.profitAndLoss.length) {
    const totalIncome = data.profitAndLoss.find((l) => l.accountCode === '4-9999');
    const totalCos = data.profitAndLoss.find((l) => l.accountCode === '5-9999');
    lines.push(`- P&L: ${data.profitAndLoss.length} line items${totalIncome ? `, Total Income: ${fmtIdrExact(totalIncome.amount)}` : ''}${totalCos ? `, Total COS: ${fmtIdrExact(totalCos.amount)}` : ''}`);
  }
  if (data.balanceSheet.length) {
    lines.push(`- Balance Sheet: ${data.balanceSheet.length} entries`);
  }
  if (data.bepMonthly.length) {
    const latest = data.bepMonthly[data.bepMonthly.length - 1];
    lines.push(`- BEP Analysis: ${data.bepMonthly.length} months, Latest: ${latest.period} (Coverage: ${latest.bepCoverage.toFixed(2)}x)`);
  }
  if (data.monthOnMonth.length) {
    lines.push(`- Month-on-Month: ${data.monthOnMonth.length} line items`);
  }
  if (data.monthlyVariance.length) {
    lines.push(`- Variance Analysis: ${data.monthlyVariance.length} metrics`);
  }
  if (data.summaryPl.length) {
    lines.push(`- Multi-Year P&L: ${data.summaryPl.length} years`);
  }

  return lines.join('\n');
}

/**
 * Build a prompt for generating structured dashboard data (action plan, targets, levers).
 * This is called as a third AI phase after the Business Review and Executive Summary.
 */
export function buildDashboardPrompt(data: ExcelData, additionalContext?: string): string {
  const sections: string[] = [
    `# Red Ruby Dashboard Data Generation`,
    ``,
    `You are a financial analyst for Red Ruby Club & Terrace Bar. Based on the financial data below, generate structured JSON data for the dashboard.`,
    ``,
    `Return ONLY a JSON object with exactly three keys: "actionPhases", "targetRows", and "levers".`,
    ``,
    `### actionPhases — Array of objects with: id, title, period, impact, actions (string array)`,
    `Create 2-3 action phases with specific, actionable steps based on the financial data.`,
    ``,
    `### targetRows — Array of objects with: metric, may, conservative, realistic, aspirational, bold (optional boolean)`,
    `Create 5 target rows: Monthly Revenue, Monthly EBITDA, EBITDA Margin, Guests/Month, Avg Spend/Guest.`,
    `Use actual data from the BEP/P&L for "may" values and realistic projections for the other columns.`,
    ``,
    `### levers — Array of objects with: num, title, summary, details (string array)`,
    `Create 5 interconnected strategic levers based on the financial analysis.`,
    ``,
    `## SOURCE DATA`,
    ``,
    buildCompanyInfoSection(data),
    buildProfitAndLossSection(data.profitAndLoss),
    buildBepSection(data.bepMonthly),
    buildMonthOnMonthSection(data.monthOnMonth),
    buildMonthlyVarianceSection(data),
  ];

  if (additionalContext) {
    sections.push('');
    sections.push('## Additional Context — AI Findings');
    sections.push(additionalContext);
  }

  return sections.join('\n');
}
