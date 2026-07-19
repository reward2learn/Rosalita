/**
 * Expense receipt OCR + parse — ported from website/lib/handlers/expense-receipt.js
 */
import { resolveOpenAiKey, resolveOpenAiBaseUrl } from '@/lib/openai';
import { getActualsDepartment } from '@/domain/actuals/monthly-actuals-schema';
import { parseExpenseText } from '@/domain/pos/expense-extract';

const EXPENSE_OCR_PROMPT = `You transcribe expense invoices, payroll slips, and payment receipts for Red Ruby Bali (Indonesia).

Return ONLY valid JSON:
{ "text": "full verbatim transcription as a single string" }

Rules:
- Transcribe ALL visible text, preserving line breaks (use \\n).
- Include vendor names, dates, line items, quantities, unit prices, subtotals, tax, and grand totals.
- Fix obvious OCR errors only when the intended value is clear.
- Do NOT summarize or return structured JSON fields — plain text only.
- If multiple images, separate pages with a blank line and "---".`;

export async function handleExpenseScan(body: { images?: unknown }): Promise<{ status: number; body: Record<string, unknown> }> {
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
    const resp = await fetch(`${resolveOpenAiBaseUrl()}/chat/completions`, {
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
        max_tokens: 16000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      }),
    });

    if (!resp.ok) {
      console.error('[expense/scan] OpenAI error:', resp.status);
      return { status: 502, body: { success: false, error: 'Vision OCR request failed' } };
    }

    const data = await resp.json() as { choices?: { message?: { content?: string } }[] };
    const raw = data.choices?.[0]?.message?.content;
    if (!raw) return { status: 502, body: { success: false, error: 'No transcription from vision model' } };

    let parsed: { text?: string };
    const cleanText = (s: string) => s.trim().replace(/\n{3,}/g, '\n\n');
    try {
      parsed = JSON.parse(raw) as { text?: string };
      if (parsed.text) parsed.text = cleanText(parsed.text);
    } catch {
      const mdMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
      if (mdMatch) {
        try {
          const inner = JSON.parse(mdMatch[1].trim()) as { text?: string };
          parsed = { text: cleanText(inner.text || mdMatch[1]) };
        } catch {
          const textMatch = raw.match(/"text"\s*:\s*"([\s\S]*?)"\s*[,\}]/);
          if (textMatch) {
            parsed = { text: cleanText(textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')) };
          } else {
            parsed = { text: cleanText(raw) };
          }
        }
      } else {
        const textMatch = raw.match(/"text"\s*:\s*"([\s\S]*?)"\s*\}/);
        if (textMatch) {
          parsed = { text: cleanText(textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"')) };
        } else {
          parsed = { text: cleanText(raw) };
        }
      }
    }

    const text = typeof parsed.text === 'string' ? parsed.text.trim() : '';
    if (!text) return { status: 502, body: { success: false, error: 'Empty transcription — try a clearer photo' } };

    return { status: 200, body: { success: true, data: { text } } };
  } catch (err) {
    console.error('[expense/scan] error:', err);
    return { status: 500, body: { success: false, error: 'Scan failed' } };
  }
}

export async function handleExpenseParse(body: {
  text?: unknown;
  department?: unknown;
  useAi?: unknown;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  const dept = String(body.department ?? '').trim();
  if (!getActualsDepartment(dept)) {
    return { status: 400, body: { success: false, error: 'Valid department is required' } };
  }
  if (!body.text || typeof body.text !== 'string' || !body.text.trim()) {
    return { status: 400, body: { success: false, error: 'Receipt text is required' } };
  }

  try {
    const result = await parseExpenseText(body.text, dept, { useAi: body.useAi === true });
    if (!Object.keys(result.inputs || {}).length) {
      return {
        status: 422,
        body: {
          success: false,
          error: 'Could not map amounts from receipt text. Edit the text and try again.',
          data: result,
        },
      };
    }
    return { status: 200, body: { success: true, data: result } };
  } catch (err) {
    console.error('[expense/parse] error:', err);
    return {
      status: 500,
      body: { success: false, error: err instanceof Error ? err.message : 'Parse failed' },
    };
  }
}
