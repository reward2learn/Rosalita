/**
 * POS OCR scan + text parse handlers (mounted on /api/pos?action=scan|parse).
 */
import { resolveOpenAiKey } from '../openai.js';
import {
  parsePosTextHeuristic,
  extractPosWithAi,
  mergeExtractions,
} from '../pos-extract.js';

const ADMIN_KEY = process.env.METRICS_WRITE_API_KEY || 'rosalita2026';

const OCR_PROMPT = `You transcribe Rosalita Cantina POS Z Sales Day Report thermal receipt photos (SPICERY -ROSALITA- BALI).

Return ONLY valid JSON:
{ "text": "full verbatim transcription as a single string" }

Rules:
- Transcribe ALL visible text from the receipt image(s), preserving logical line breaks (use \\n).
- Include section headers (MEDIA, GROUP SALES, SALES CATEGORY, etc.), labels, quantities, and amounts exactly as printed.
- Fix obvious OCR character errors only when the intended value is clear (e.g. "Lovers" → "Covers").
- Do NOT summarize, skip sections, or return structured field JSON — plain text only.
- If multiple images are provided, transcribe each in order separated by a blank line and "---" between pages.`;

function requireAdmin(req, res) {
  const adminKey = req.headers['x-admin-key'];
  if (adminKey !== ADMIN_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export async function handlePosScan(req, res) {
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
          { role: 'system', content: OCR_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: images.length > 1
                  ? `Transcribe all text from these ${images.length} POS Z-report receipt pages. Return JSON with a "text" field only.`
                  : 'Transcribe all text from this POS Z-report receipt. Return JSON with a "text" field only.',
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
      console.error('[pos/scan] OpenAI error:', resp.status, errText.slice(0, 300));
      return res.status(502).json({ error: 'Vision OCR request failed' });
    }

    const data = await resp.json();
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return res.status(502).json({ error: 'No transcription from vision model' });
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(502).json({ error: 'Could not parse OCR response' });
    }

    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) {
      return res.status(502).json({ error: 'Empty transcription — try a clearer photo' });
    }

    return res.status(200).json({ data: { text } });
  } catch (err) {
    console.error('[pos/scan] error:', err);
    return res.status(500).json({ error: 'Scan failed' });
  }
}

export async function handlePosParse(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { text, useAi } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'POS text is required' });
  }

  const trimmed = text.trim();
  if (trimmed.length > 50000) {
    return res.status(400).json({ error: 'Text too long (max 50,000 characters)' });
  }

  try {
    let result = parsePosTextHeuristic(trimmed);

    const needsAi = useAi === true
      || result.confidence === 'low'
      || !result.nett_sales
      || !result.total_covers;

    if (needsAi) {
      const apiKey = await resolveOpenAiKey();
      if (apiKey) {
        try {
          const aiResult = await extractPosWithAi(trimmed, apiKey);
          result = mergeExtractions(result, aiResult);
        } catch (err) {
          console.warn('[pos/parse] AI fallback failed:', err.message);
          if (!result.nett_sales && !result.total_covers) {
            return res.status(502).json({
              error: 'Could not parse text. Try cleaning the paste or enable OpenAI API key.',
            });
          }
        }
      } else if (!result.nett_sales && !result.total_covers) {
        return res.status(503).json({
          error: 'Could not parse text and OpenAI API key is not configured.',
        });
      }
    }

    return res.status(200).json({ data: result });
  } catch (err) {
    console.error('[pos/parse] error:', err);
    return res.status(500).json({ error: 'Parse failed' });
  }
}
