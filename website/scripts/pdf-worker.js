/**
 * PDF Worker Script – Asynchronous background job executor
 * --------------------------------------------------------
 * This script runs as a separate Node process (via `node scripts/pdf-worker.js`).
 * It polls the `job_queue` table for pending jobs, executes the heavy work using
 * the existing `generateDashboardPdf` utility, and then updates the job record.
 *
 * In production you would replace the simple interval‑based polling with a proper
 * queue system (e.g., RabbitMQ, SQS, or Vercel cron). For this prototype we use a
 * deterministic loop that fetches jobs once per second.
 */

import { query } from '../lib/db.js'; // Existing DB helper – Postgres client wrapper
import { generateDashboardPdf, PDF_FILENAME } from '../lib/pdf-lib.js'; // Original PDF generation logic (unchanged)
import { getOrigin } from '../lib/auth-lib.js';

/**
 * Retrieves the next pending job from the database.
 * Returns null if no jobs are waiting.
 */
async function fetchNextPendingJob() {
  const result = await query(
    `SELECT job_id, payload FROM job_queue WHERE status = 'PENDING' ORDER BY created_at ASC LIMIT 1;`
  );
  return result.rows[0] || null;
}

/**
 * Updates the job row with new status and optional data.
 */
async function updateJob(jobId, { status, completedData }) {
  const updatedAtClause = `updated_at = CURRENT_TIMESTAMP`;
  if (completedData) {
    await query(
      `UPDATE job_queue SET status = $1, completed_data = $2::jsonb, ${updatedAtClause} WHERE job_id = $3;`,
      [status, JSON.stringify(completedData), jobId]
    );
  } else {
    await query(`UPDATE job_queue SET status = $1, ${updatedAtClause} WHERE job_id = $2;`, [status, jobId]);
  }
}

/**
 * Core poll‑and‑process loop (very naive implementation).
 */
async function runWorker() {
  console.log('[PDF-Worker] Starting polling loop...');
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const job = await fetchNextPendingJob();
      if (!job) {
        // No pending jobs – short sleep before next poll.
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }

      console.log(`[PDF-Worker] Picked up job ${job.job_id}`);
      await updateJob(job.job_id, { status: 'PROCESSING' });

      // Payload shape – we expect `{ sessionId: string }` but keep it generic.
      const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
      // Origin is required for the PDF generation utility; assume you set a default here.
      const origin = process.env.ORIGIN_URL || `https://${process.env.VERCEL_PROJECT_NAME}.vercel.app`;

      // 1️⃣ Run heavy PDF generation – this step may still throw lib‑dependency errors.
      let pdfBuffer;
      try {
        pdfBuffer = await generateDashboardPdf(origin, payload.sessionCookie || '', payload.pagePath || '/');
      } catch (pdfErr) {
        console.error(`[PDF-Worker] Generation error for job ${job.job_id}:`, pdfErr.message);
        await updateJob(job.job_id, { status: 'FAILED', completedData: { error: pdfErr.message } });
        continue; // Move to next pending job.
      }

      // 2️⃣ Store PDF data – in a real system you would push this into object storage (S3/Blob) and only store the URL.
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
      await updateJob(job.job_id, {
        status: 'COMPLETED',
        completedData: { pdfBase64: base64Pdf, filename: PDF_FILENAME }
      });

      console.log(`[PDF-Worker] Job ${job.job_id} completed successfully.`);
    } catch (err) {
      // Global worker error – log and keep looping.
      console.error('[PDF-Worker] Unexpected error:', err.message);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

// Kick‑off the poller when this script is executed directly (`node scripts/pdf-worker.js`).
if (import.meta?.url === `file://${process.argv[1]}`) {
  runWorker().catch(e => console.error('[PDF-Worker] Fatal error:', e));
}

export default { runWorker };
