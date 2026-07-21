/**
 * Prompt Builder
 *
 * Takes extracted Excel data and builds a comprehensive system prompt
 * that instructs the AI to generate:
 *   1. Business Review (Markdown) — multi-part review with data tables
 *   2. Executive Summary (Markdown) — concise executive overview
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

export function buildGenerationPrompt(data: ExcelData): string {
  const sections: string[] = [
    `# Red Ruby Financial Analysis — AI Content Generation Prompt`,
    ``,
    `You are a financial analyst and business writer for Red Ruby Club & Terrace Bar (PT Taman Bintang Bali) in Petitenget, Bali.`,
    `Your task is to generate TWO documents based EXCLUSIVELY on the financial data provided below.`,
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
    `  "executiveSummary": "# Red Ruby Club & Terrace Bar — Executive Summary\\n\\n## Business Overview..."`,
    `}`,
    `\`\`\``,
    ``,
    `### Business Review Requirements`,
    `Generate a comprehensive multi-part business review in Markdown with the following structure:`,
    ``,
    `- **Part A: Current Situation — The Numbers** — Revenue streams, monthly revenue table (Jan-Jun 2026 from BEP data), cost structure, seasonal challenge analysis`,
    `- **Part B: Break-Even Analysis** — BEP coverage trends, fixed cost analysis, gap vs actual revenue`,
    `- **Part C: Revenue Breakdown** — Detail by revenue stream (Food, Beverage, Shisha, Cigarettes, Ticket, Misc) with actual June 2026 figures from the P&L`,
    `- **Part D: Cost of Sales Analysis** — Breakdown by category (Food, Beverage, Entertainment, Promoter Fees) with percentages`,
    `- **Part E: Expense Structure** — Salary & wages, operating expenses, marketing, depreciation`,
    `- **Part F: Month-on-Month Comparison** — Variance analysis from previous month`,
    `- **Part G: Balance Sheet Overview** — Key assets, cash position, inventory`,
    `- **Part H: Multi-Year Trend** — Revenue trends from SUMPL data across available years`,
    `- **Part I: Key Insights & Recommendations** — Data-driven observations and actionable recommendations`,
    ``,
    `Each part should include data tables formatted in Markdown. Use IDR formatting (e.g., "IDR 1.98B"). Include percentage calculations where relevant.`,
    `Write in a professional, analytical tone.`,
    ``,
    `### Executive Summary Requirements`,
    `Generate a concise executive summary in Markdown with:`,
    ``,
    `- **Business Overview** — Brief description of the venue and operating model`,
    `- **Financial Highlights** — Key metrics from June 2026 P&L`,
    `- **Month-on-Month Performance** — Comparison with previous month`,
    `- **Break-Even Position** — Current BEP coverage and trend`,
    `- **Key Risks & Opportunities** — Top 3-5 bullet points`,
    `- **Bottom Line** — One-paragraph conclusion`,
    ``,
    `Keep the executive summary to 1-2 pages when rendered. Use clear section headers and data tables.`,
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
