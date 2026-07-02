/**
 * @fileoverview Knowledge Service abstraction layer for AI Chat API.
 * This module contains all complex business logic related to fetching, aggregating, 
 * and formatting data context derived from the PostgreSQL database schema (daily_metrics).
 * It isolates database concerns from the main API handler, allowing multiple microservices 
 * or internal agents to consume this structured knowledge base.
 */

import { query, isReady, getSecret } from '../lib/db.js';
import { decrypt } from '../lib/crypto.js';
import { MONTHLY_TARGETS } from '../lib/knowledge-base.js'; // Assuming this constant exists globally or in lib/knowledge-base.js

/**
 * Checks if the user message suggests a data query that requires database context.
 * @param {string} message - The user's plain text input message.
 * @returns {boolean} True if DB access is likely needed.
 */
export function detectDatabaseQuery(message) {
  const dbKeywords = [
    'actual', 'current', 'tracking', 'kpi', 'performance',
    'how are we', 'how did we', 'what was', 'what were',
    'revenue', 'ebitda', 'guests', 'staff cost',
    'trend', 'compare', 'vs target', 'vs projection',
    'month to date', 'mtd', 'ytd', 'last month', 'this month',
    'progress', 'on track', 'behind', 'ahead',
    'show me', 'numbers', 'data', 'report', 'daily metrics',
    'weekly', 'monthly', 'average spend', 'avg spend',
    'spend per guest', ' performance',
  ];
  const lower = message.toLowerCase();
  return dbKeywords.some(k => lower.includes(k));
}

/**
 * Fetches and aggregates comprehensive context from the database based on a user message.
 * This is the core, single point of truth for metric data aggregation.
 * @param {string} message - The initiating query message (used only for type hinting).
 * @returns {Promise<string|null>} A formatted Markdown string detailing current KPIs and trends, or null if no data exists/query fails.
 */
export async function fetchDatabaseContext(message) {
  let parts = [];

  // --- 1. Recent Daily Entries (Last 7 days) ---
  try {
    const recent = await query(
      `SELECT date, revenue, guests_count, avg_spend, staff_count, staff_cost, food_cost, beverage_cost, (revenue - staff_cost - food_cost - beverage_cost) AS ebitda FROM daily_metrics ORDER BY date DESC LIMIT 7`
    );
    if (recent.rows.length > 0) {
      parts.push('=== RECENT DAILY DATA (last 7 entries) ===');
      parts.push('date | revenue | guests | avg_spend | staff_cost | food_cost | bev_cost | ebitda');
      for (const r of recent.rows) {
        // Use safer Number() conversions and allow nulls to display properly
        const revenueF = r.revenue !== null ? Math.round(r.revenue).toLocaleString() : '-';
        const guestsF = r.guests_count?.toString() || '?';
        const avgSpendF = r.avg_spend ? Math.round(r.avg_spend).toLocaleString() : '-';
        const staffCostF = r.staff_cost !== null ? Math.round(r.staff_cost).toLocaleString() : '-';
        const foodCostF = r.food_cost !== null ? Math.round(r.food_cost).toLocaleString() : '-';
        const bevCostF = r.beverage_cost !== null ? Math.round(r.beverage_cost).toLocaleString() : '-';
        const ebitdaF = r.ebitda !== null ? Math.round(r.ebitda).toLocaleString() : '-';
        parts.push(`${r.date} | ${revenueF} | ${guestsF} | ${avgSpendF} | ${staffCostF} | ${foodCostF} | ${bevCostF} | ${ebitdaF}`);
      }
    }
  } catch (e) {
    console.warn('[knowledgeService] Failed to fetch recent daily data:', e.message);
  }

  // --- 2. Current Month Aggregate ---
  // This block must handle potential errors and empty result sets gracefully.
  try {
    const currentMonth = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
        SUM(revenue) AS total_revenue,
        COUNT(*) AS days_count,
        ROUND(AVG(guests_count)) AS avg_guests,
        ROUND(AVG(avg_spend)) AS avg_spend,
        ROUND(AVG(staff_count)) AS avg_staff,
        SUM(staff_cost) AS total_staff_cost,
        SUM(food_cost) AS total_food_cost,
        SUM(beverage_cost) AS total_beverage_cost,
        SUM(revenue - staff_cost - food_cost - beverage_cost) AS total_ebitda,
        CASE WHEN SUM(revenue) IS NOT NULL AND SUM(revenue) > 0 THEN ROUND((SUM(staff_cost) / SUM(revenue)) * 100, 1) ELSE NULL END AS staff_cost_pct
      FROM daily_metrics
      WHERE DATE_TRUNC('month', date) = DATE_TRUNC('month', CURRENT_DATE - INTERVAL 'day'::interval) -- Adjusting date logic for better coverage on first of month queries
      GROUP BY DATE_TRUNC('month', date)
    `);

    if (currentMonth.rows.length > 0) {
      const cm = currentMonth.rows[0];
      let contextString = '\n=== CURRENT MONTH CONTEXT ===\n';
      contextString += `Month: ${cm.month}, Days: ${cm.days_count}\n`;
      contextString += `Revenue: ${Number(cm.total_revenue).toLocaleString()}\n`;
      contextString += `EBITDA: ${Number(cm.total_ebitda).toLocaleString()}\n`;
      contextString += `Avg Guests/Day: ${cm.avg_guests}\n`;
      contextString += `Avg Spend: ${Number(cm.avg_spend).toLocaleString()}\n`;
      contextString += `Staff Cost %: ${cm.staff_cost_pct}% \n`;

      // Target Comparison Logic (External knowledge dependency)
      const target = MONTHLY_TARGETS.find(t => t.month === cm.month);
      if (target) {
        const projRev = null; // Cannot calculate accurate projection here without knowing the date range, keeping it qualitative for now. 
        contextString += '\n--- VS TARGET COMPARISON ---\n';
        contextString += `Target Revenue: ${Number(target.revenue).toLocaleString()}, Projected (estimate): N/A\n`;
        contextString += `Target Guests/Day: ${target.guests}, Actual: ${cm.avg_guests}\n`;
      }

      parts.push(contextString);
    }
  } catch (e) {
    console.warn('[knowledgeService] Failed to fetch current month context:', e.message);
  }

  // --- 3. Weekly Trend (Last 4 full weeks) ---
  try {
    const weekData = await query(`
      SELECT 
        DATE_TRUNC('week', date)::date AS week_start,
        SUM(revenue) AS total_revenue,
        SUM(guests_count) AS total_guests,
        SUM(revenue - staff_cost - food_cost - beverage_cost) AS total_ebitda
      FROM daily_metrics
      WHERE DATE_TRUNC('week', date) >= DATE_TRUNC('week', CURRENT_DATE - INTERVAL '4 weeks')
      GROUP BY DATE_TRUNC('week', date)
      ORDER BY week_start DESC
    `);
    if (weekData.rows.length > 1) {
      parts.push('\n=== WEEKLY TREND ===');
      for (const w of weekData.rows) {
        // Safer formatting for display
        parts.push(`${w.week_start} | Rev: ${Number(w.total_revenue).toLocaleString()} | Guests: ${w.total_guests} | EBITDA: ${Number(w.total_ebitda).toLocaleString()}`);
      }
    }
  } catch (e) {
    console.warn('[knowledgeService] Failed to fetch weekly trend:', e.message);
  }

  // --- 4. Monthly Historical Data This Year ---
  try {
    const monthly = await query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', date), 'YYYY-MM') AS month,
        SUM(revenue) AS total_revenue,
        SUM(guests_count) AS total_guests,
        SUM(revenue - staff_cost - food_cost - beverage_cost) AS total_ebitda,
        CASE WHEN SUM(revenue) > 0 THEN ROUND((SUM(staff_cost) / SUM(revenue)) * 100, 1) ELSE NULL END AS staff_cost_pct
      FROM daily_metrics
      WHERE DATE_TRUNC('year', date) = DATE_TRUNC('year', CURRENT_DATE)
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month ASC
    `);
    if (monthly.rows.length > 0) {
      parts.push('\n=== MONTHLY PERFORMANCE YTD ===');
      for (const m of monthly.rows) {
        const t = MONTHLY_TARGETS.find(x => x.month === m.month);
        // Use local formatting and checks here for robustness
        const targetSuffix = t ? ` [Target Rev: ${Number(t.revenue).toLocaleString()}]` : '';
        parts.push(`${m.month}: Rev ${Number(m.total_revenue).toLocaleString()} ${targetSuffix} | EBITDA ${Number(m.total_ebitda).toLocaleString()} | Guests ${m.total_guests} | StaffCost ${m.staff_cost_pct}%`);
      }
    }
  } catch (e) {
    console.warn('[knowledgeService] Failed to fetch monthly historical data:', e.message);
  }

  if (parts.length === 0) {
    return null; // Return null instead of empty string for cleaner usage
  }
  return parts.join('\n\n');
}