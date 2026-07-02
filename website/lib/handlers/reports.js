/**
 * Legacy metrics reports — GET handler (mounted on financial-overview?resource=reports).
 */
import { query } from '../db.js';

export async function handleReports(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { period = 'monthly', resource } = req.query;

  try {
    if (resource === 'targets') {
      const targetsResult = await query('SELECT * FROM monthly_targets ORDER BY month ASC');
      return res.status(200).json({ data: targetsResult.rows });
    }

    let metricsQuery;

    if (period === 'daily') {
      metricsQuery = `
        SELECT report_date AS date,
               nett_sales AS revenue,
               total_covers AS guests_count,
               avg_covers AS avg_spend,
               total_bills,
               gofood_amount AS gofood_revenue,
               dine_in_amount AS direct_orders,
               tot_collection_amount,
               total_sales,
               tax_10_amount,
               service_7_amount
        FROM daily_z_reports
        ORDER BY report_date ASC
      `;
    } else if (period === 'weekly') {
      metricsQuery = `
        SELECT
          DATE_TRUNC('week', report_date)::date AS period_start,
          SUM(nett_sales) AS revenue,
          SUM(total_covers) AS guests_count,
          ROUND(AVG(avg_covers)) AS avg_spend,
          SUM(total_bills) AS total_bills,
          SUM(gofood_amount) AS gofood_revenue,
          SUM(dine_in_amount) AS direct_orders,
          SUM(tot_collection_amount) AS tot_collection_amount
        FROM daily_z_reports
        GROUP BY DATE_TRUNC('week', report_date)
        ORDER BY period_start ASC
      `;
    } else {
      metricsQuery = `
        SELECT
          TO_CHAR(DATE_TRUNC('month', report_date), 'YYYY-MM') AS month,
          SUM(nett_sales) AS revenue,
          SUM(total_covers) AS guests_count,
          ROUND(AVG(avg_covers)) AS avg_spend,
          SUM(total_bills) AS total_bills,
          SUM(gofood_amount) AS gofood_revenue,
          SUM(dine_in_amount) AS direct_orders,
          SUM(tot_collection_amount) AS tot_collection_amount
        FROM daily_z_reports
        GROUP BY DATE_TRUNC('month', report_date)
        ORDER BY month ASC
      `;
    }

    const [metricsResult, targetsResult] = await Promise.all([
      query(metricsQuery),
      query('SELECT * FROM monthly_targets ORDER BY month ASC'),
    ]);

    return res.status(200).json({
      period,
      metrics: metricsResult.rows,
      targets: targetsResult.rows,
    });
  } catch (err) {
    console.error('[reports]', err);
    return res.status(500).json({ error: 'Query failed' });
  }
}
