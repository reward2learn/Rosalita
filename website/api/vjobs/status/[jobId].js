import { query } from '../../../lib/db.js';
import { generateDashboardPdf, PDF_FILENAME } from '../../../lib/pdf-lib.js';

/**
 * GET /api/vjobs/status/:jobId – Return the current status of a PDF generation job.
 * If the job is still PENDING, claim and process it inline (serverless-friendly).
 */
async function claimJob(jobId) {
  const result = await query(
    `UPDATE job_queue
     SET status = 'PROCESSING', updated_at = CURRENT_TIMESTAMP
     WHERE job_id = $1 AND status = 'PENDING'
     RETURNING job_id, payload`,
    [jobId]
  );
  return result.rows[0] || null;
}

async function processJob(job) {
  const payload = typeof job.payload === 'string' ? JSON.parse(job.payload) : job.payload;
  try {
    const pdfBuffer = await generateDashboardPdf(payload.origin, payload.sessionCookie || '', payload.pagePath || '/index.html');
    const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
    const completedData = { pdfBase64: base64Pdf, filename: PDF_FILENAME };
    await query(
      `UPDATE job_queue
       SET status = 'COMPLETED', completed_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $2`,
      [JSON.stringify(completedData), job.job_id]
    );
    return { status: 'COMPLETED', pdfBase64: base64Pdf };
  } catch (err) {
    console.error('[vjobs/status] generation failed:', err.message);
    await query(
      `UPDATE job_queue
       SET status = 'FAILED', completed_data = $1::jsonb, updated_at = CURRENT_TIMESTAMP
       WHERE job_id = $2`,
      [JSON.stringify({ error: err.message }), job.job_id]
    );
    return { status: 'FAILED', details: err.message };
  }
}

function buildResponse(row) {
  const response = { status: row.status };

  if (row.status === 'FAILED' && row.completed_data) {
    try {
      const data = typeof row.completed_data === 'string'
        ? JSON.parse(row.completed_data)
        : row.completed_data;
      if (data.error) response.details = data.error;
    } catch (_) {}
  }

  if (row.status === 'COMPLETED' && row.completed_data) {
    try {
      const data = typeof row.completed_data === 'string'
        ? JSON.parse(row.completed_data)
        : row.completed_data;
      if (data.pdfBase64) response.pdfBase64 = data.pdfBase64;
    } catch (_) {}
  }

  return response;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'GET required' });
  }

  const { jobId } = req.query;
  if (!jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  try {
    let result = await query(
      `SELECT status, completed_data, payload FROM job_queue WHERE job_id = $1`,
      [jobId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: 'Job not found' });
    }

    let row = result.rows[0];

    if (row.status === 'PENDING') {
      const claimed = await claimJob(jobId);
      if (claimed) {
        const processed = await processJob(claimed);
        return res.status(200).json(processed);
      }

      result = await query(
        `SELECT status, completed_data FROM job_queue WHERE job_id = $1`,
        [jobId]
      );
      row = result.rows[0];
    }

    return res.status(200).json(buildResponse(row));
  } catch (err) {
    console.error('[vjobs/status]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
