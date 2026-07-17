/**
 * POS OCR + parse handlers — ported from website/lib/handlers/pos.js
 */
import { resolveOpenAiKey } from '@/lib/openai';
import {
  extractPosWithAi,
  mergeExtractions,
  parsePosTextHeuristic,
} from '@/domain/pos/pos-extract';

type PosExtraction = Record<string, unknown> & { confidence?: string; method?: string };

const OCR_PROMPT = `You transcribe Red Ruby Bali POS Z Sales Day Report thermal receipt photos (SPICERY -REDRUBY- BALI).

Return ONLY valid JSON:
{ "text": "full verbatim transcription as a single string" }

Rules:
- Transcribe ALL visible text from the receipt image(s), preserving logical line breaks (use \\n).
- Include section headers (MEDIA, GROUP SALES, SALES CATEGORY, etc.), labels, quantities, and amounts exactly as printed.
- Fix obvious OCR character errors only when the intended value is clear (e.g. "Lovers" → "Covers").
- Do NOT summarize, skip sections, or return structured field JSON — plain text only.
- If multiple images are provided, transcribe each in order separated by a blank line and "---" between pages.`;

export async function handlePosScan(body: { images?: unknown }): Promise<{ status: number; body: Record<string, unknown> }> {
  const images = body.images;
  if (!Array.isArray(images) || images.length === 0) {
    return { status: 400, body: { success: false, error: 'At least one image is required' } };
  }
  if (images.length > 3) {
    return { status: 400, body: { success: false, error: 'Maximum 3 images per scan' } };
  }

  const apiKey = await resolveOpenAiKey();
  if (!apiKey) {
    return {
      status: 503,
      body: { success: false, error: 'OpenAI API key not configured. Set OPENAI_API_KEY in environment variables.' },
    };
  }

  const imageContent = (images as string[]).map((img) => {
    const url = img.startsWith('data:') ? img : `data:image/jpeg;base64,${img}`;
    return { type: 'image_url', image_url: { url, detail: 'auto' } };
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
        max_tokens: 16000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      console.error('[pos/scan] OpenAI error:', resp.status);
      return { status: 502, body: { success: false, error: 'Vision OCR request failed' } };
    }

    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) {
      return { status: 502, body: { success: false, error: 'No transcription from vision model' } };
    }

    let parsed: { text?: string };
    try {
      parsed = JSON.parse(raw) as { text?: string };
    } catch {
      // Fallback: try to extract text from markdown code block or raw content
      const mdMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (mdMatch) {
        try {
          parsed = JSON.parse(mdMatch[1].trim()) as { text?: string };
        } catch {
          // Second fallback: if the raw looks like an object with a text property
          const textMatch = raw.match(/"text"\s*:\s*"([\s\S]*?)"\s*[,\}]/);
          if (textMatch) {
            parsed = { text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
          } else {
            // Final fallback: use the raw string as the transcription
            parsed = { text: raw };
          }
        }
      } else {
        // Try regex extraction of text field
        const textMatch = raw.match(/"text"\s*:\s*"([\s\S]*?)"\s*\}/);
        if (textMatch) {
          parsed = { text: textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') };
        } else {
          // Last resort: use raw as text
          parsed = { text: raw };
        }
      }
    }

    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) {
      return { status: 502, body: { success: false, error: 'Empty transcription — try a clearer photo' } };
    }

    return { status: 200, body: { success: true, data: { text } } };
  } catch (err) {
    console.error('[pos/scan] error:', err);
    return { status: 500, body: { success: false, error: 'Scan failed' } };
  }
}

export async function handlePosParse(body: {
  text?: unknown;
  useAi?: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const text = body.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return { status: 400, body: { success: false, error: 'POS text is required' } };
  }

  const trimmed = text.trim();
  if (trimmed.length > 50000) {
    return { status: 400, body: { success: false, error: 'Text too long (max 50,000 characters)' } };
  }

  try {
    let result = parsePosTextHeuristic(trimmed) as PosExtraction;

    const needsAi = body.useAi === true
      || result.confidence === 'low'
      || !result.nett_sales
      || !result.total_covers;

    if (needsAi) {
      const apiKey = await resolveOpenAiKey();
      if (apiKey) {
        try {
          const aiResult = await extractPosWithAi(trimmed, apiKey);
          result = mergeExtractions(result, aiResult) as PosExtraction;
        } catch (err) {
          console.warn('[pos/parse] AI fallback failed:', err instanceof Error ? err.message : err);
          if (!result.nett_sales && !result.total_covers) {
            return {
              status: 502,
              body: { success: false, error: 'Could not parse text. Try cleaning the paste or enable OpenAI API key.' },
            };
          }
        }
      } else if (!result.nett_sales && !result.total_covers) {
        return {
          status: 503,
          body: { success: false, error: 'Could not parse text and OpenAI API key is not configured.' },
        };
      }
    }

    return { status: 200, body: { success: true, data: result } };
  } catch (err) {
    console.error('[pos/parse] error:', err);
    return { status: 500, body: { success: false, error: 'Parse failed' } };
  }
}
