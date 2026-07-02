/**
 * Expense receipt OCR + field extraction (mounted on /api/pos?action=expense-scan|expense-parse).
 */
import { resolveOpenAiKey } from '../openai.js';
import { getActualsDepartment } from '../monthly-actuals-schema.js';
import { parseExpenseText } from '../expense-extract.js';

const ADMIN_KEY = process.env.METRICS_WRITE_API_KEY || 'rosalita2026';

const EXPENSE_OCR_PROMPT = `You transcribe expense invoices, payroll slips, and payment receipts for Rosalita Cantina (Indonesia).

Return ONLY valid JSON:
{ "text": "full verbatim transcription as a single string" }

Rules:
- Transcribe ALL visible text, preserving line breaks (use \\n).
- Include vendor names, dates, line items, quantities, unit prices, subtotals, tax, and grand totals.
- Fix obvious OCR errors only when the intended value is clear.
- Do NOT summarize or return structured JSON fields — plain text only.
- If multiple images, separate pages with a blank line and "---".`;

function requireAdmin(req, res) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function handleExpenseScan(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { images } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'At least one image is required' });
  }
  if (images.length > 3) {
    return res.status(400).json({ error: 'Maximum 3 images per scan' });
  }

  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    return res.status(503).json({
      error: 'OpenAI API key not configured. Set OPENAI_API_KEY in environment variables.',
    });
  }

  const imageContent = images.map((img) => {
    const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    return { type: 'image_url', image_url: { url, detail: 'high' } };
  });

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: EXPENSE_OCR_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: images.length > 1
                  ? `Transcribe all text from these ${images.length} expense receipt pages. Return JSON with a "text" field only.`
                  : 'Transcribe all text from this expense receipt. Return JSON with a "text" field only.',
              },
              ...imageContent,
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('[expense/scan] OpenAI error:', resp.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'Vision OCR request failed' });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return res.status(502).json({ error: 'No transcription from vision model' });

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Could not parse OCR response' });
    }

    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) return res.status(502).json({ error: 'Empty transcription — try a clearer photo' });

    return res.status(200).json({ data: { text } });
  } catch (err) {
    console.error('[expense/scan] error:', err);
    return res.status(500).json({ error: 'Scan failed' });
  }
}

export async function handleExpenseParse(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { text, department, useAi } = req.body || {};
  const dept = String(department || '').trim();
  if (!getActualsDepartment(dept)) {
    return res.status(400).json({ error: 'Valid department is required' });
  }
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Receipt text is required' });
  }

  try {
    const result = await parseExpenseText(text, dept, { useAi: useAi === true });
    if (!Object.keys(result.inputs || {}).length) {
      return res.status(422).json({
        error: 'Could not map amounts from receipt text. Edit the text and try again.',
        data: result,
      });
    }
    return res.status(200).json({ data: result });
  } catch (err) {
    console.error('[expense/parse] error:', err);
    return res.status(500).json({ error: err.message || 'Parse failed' });
  }
}
