// @ts-nocheck — ported from website/lib/pos-extract.js (P3)
import { Z_REPORT_FIELD_KEYS } from '@/domain/z-report/z-report-schema';
import { toPeriodApiValue } from '@/domain/shared/date-utils';

export const POS_EXTRACTION_PROMPT = `You extract ALL fields from a Red Ruby Bali POS Z Sales Day Report (SPICERY -REDRUBY- BALI) OCR text.

Return ONLY valid JSON using these snake_case keys (null if missing):
report_date (YYYY-MM-DD), report_time (HH:MM), operator, report_no, pos_group,
period_start, period_end (ISO datetime if possible),
item_sales_qty, item_sales_amount, item_discount_qty, item_discount_amount,
bill_discount_qty, bill_discount_amount, foc_items_qty, foc_items_amount,
foc_bill_qty, foc_bill_amount, total_sales, estimated_sales,
cash_qty, cash_amount, bca_qty, bca_amount, gojek_pay_qty, gojek_pay_amount,
mandiri_qty, mandiri_amount, total_card_qty, total_card_amount, total_cash_qty, total_cash_amount,
refund_qty, refund_amount, pre_send_void_qty, pre_send_void_amount, post_send_void_qty, post_send_void_amount,
tot_collection_qty, tot_collection_amount,
tax_10_amount, service_7_amount, nett_sales,
bills_pending_qty, bills_pending_amount, total_bills, avg_bills, total_covers, avg_covers,
begin_receipt_no, end_receipt_no,
group_beverage_qty, group_beverage_amount, group_food_qty, group_food_amount, group_total_qty, group_total_amount,
group_foc_beverage_qty, group_foc_beverage_amount, group_foc_food_qty, group_foc_food_amount,
dine_in_qty, dine_in_amount, gofood_qty, gofood_amount, total_ctgry_qty, total_ctgry_amount,
bill_disc_20_qty, bill_disc_20_amount, total_item_discount_qty, total_item_discount_amount,
confidence ("high"|"medium"|"low")

Rules:
- nett_sales / total_sales = Nett Sales or Total Sales (=) — NOT ItemSales, NOT TotCollection
- total_covers = Total # of Covers (OCR may say Lovers) — NOT bill count
- gofood_qty/amount = GO-FOOD in SALES CATEGORY — NOT GOJEK in MEDIA
- gojek_pay_* = GOJEK payment line in MEDIA section
- report_date = header date (29 Jun 2026), not period range start
- Strip commas; amounts as integers in IDR`;

export function normalizePosText(text) {
  return String(text || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/[⁃•·\u2022\t]/g, '\n')
    .replace(/\r\n/g, '\n');
}

export function parseIdrAmount(raw) {
  if (raw === null || raw === undefined || raw === '') return null;
  let s = String(raw).trim().replace(/\s/g, '');
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+,\d+$/.test(s)) {
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n) : null;
  }
  if (/^\d+,\d{3},\d{2}$/.test(s)) {
    s = s.replace(/,(\d{2})$/, '.$1').replace(/,/g, '');
  } else {
    s = s.replace(/,/g, '');
  }
  s = s.replace(/\.$/, '');
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

function parseLooseIdr(raw) {
  if (!raw) return null;
  let s = String(raw).trim().replace(/\s/g, '');
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return null;
  if (/^\d{2}\.\d{3},\d{3}$/.test(s)) {
    return parseInt(s.replace(/\./g, '').replace(',', ''), 10);
  }
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) return parseIdrAmount(s);
  return parseIdrAmount(raw);
}

const IDR_CHUNK = /(\d{1,2},\d{3},\d{3})\.?/g;

function firstIdrAfterLabel(text, labelRegex, maxGap = 150, min = 0, max = Infinity) {
  const idx = text.search(labelRegex);
  if (idx < 0) return null;
  const slice = text.slice(idx, idx + maxGap);
  for (const m of slice.matchAll(IDR_CHUNK)) {
    const n = parseIdrAmount(m[1]);
    if (n !== null && n >= min && n <= max) return n;
  }
  return null;
}

function findRepeatedAmount(text, min = 8_000_000, max = 80_000_000) {
  const counts = new Map();
  for (const m of text.matchAll(IDR_CHUNK)) {
    const n = parseIdrAmount(m[1]);
    if (n !== null && n >= min && n <= max) counts.set(n, (counts.get(n) || 0) + 1);
  }
  let best = null;
  let bestCount = 0;
  for (const [n, c] of counts) {
    if (c > bestCount) { best = n; bestCount = c; }
  }
  return best;
}

function firstLooseIdrAfterLabel(text, labelRegex, maxGap = 100, min = 0, max = Infinity, stopRegex) {
  const match = text.match(labelRegex);
  if (!match || match.index === undefined) return null;
  let slice = text.slice(match.index + match[0].length, match.index + match[0].length + maxGap);
  if (stopRegex) {
    const stop = slice.search(stopRegex);
    if (stop > 0) slice = slice.slice(0, stop);
  }
  for (const pattern of [/\d{2}\.\d{3},\d{3}/g, /\d{1,2},\d{3},\d{3}\.?/g, /\d{1,3}(?:,\s*\d{3})+(?:\.\d+)?/g]) {
    for (const m of slice.matchAll(pattern)) {
      const n = parseLooseIdr(m[0]);
      if (n !== null && n >= min && n <= max) return n;
    }
  }
  return null;
}

function qtyAmountAfter(flat, labelRe, stopRe, minAmt = 0, maxAmt = Infinity) {
  const match = flat.match(labelRe);
  if (!match || match.index === undefined) return {};
  let slice = flat.slice(match.index + match[0].length, match.index + match[0].length + 90);
  if (stopRe) {
    const stop = slice.search(stopRe);
    if (stop > 0) slice = slice.slice(0, stop);
  }
  const qa = slice.match(/(\d{1,4})\s+([\d.,\s]{4,})/);
  if (qa) {
    const amount = parseLooseIdr(qa[2]);
    if (amount !== null && amount >= minAmt && amount <= maxAmt) {
      return { qty: parseInt(qa[1], 10), amount };
    }
  }
  const amount = firstLooseIdrAfterLabel(slice, /./, 90, minAmt, maxAmt);
  return amount !== null ? { amount } : {};
}

function assignPair(raw, prefix, pair) {
  if (pair.qty != null) raw[`${prefix}_qty`] = pair.qty;
  if (pair.amount != null) raw[`${prefix}_amount`] = pair.amount;
}

export function parsePosTextHeuristic(rawText) {
  const text = normalizePosText(rawText);
  const flat = text.replace(/\n/g, ' ');
  const raw = {};

  const dateMatch = flat.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})/i);
  if (dateMatch) {
    const months = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06', jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
    raw.report_date = `${dateMatch[3]}-${months[dateMatch[2].toLowerCase().slice(0, 3)]}-${String(dateMatch[1]).padStart(2, '0')}`;
    const timeMatch = flat.slice(dateMatch.index).match(/\d{2}:\d{2}/);
    if (timeMatch) raw.report_time = timeMatch[0];
  }

  const rangeMatch = flat.match(/(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})\s*[-–]\s*(\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}:\d{2})/);
  if (rangeMatch) {
    raw.period_start = parsePosDateTime(rangeMatch[1]);
    raw.period_end = parsePosDateTime(rangeMatch[2]);
    if (!raw.report_date) raw.report_date = raw.period_end?.slice(0, 10);
  }

  const opMatch = flat.match(/OP:\s*([A-Za-z0-9.]+)/i);
  if (opMatch) raw.operator = opMatch[1];
  const rnoMatch = flat.match(/Report\s*:?\s*No:?\s*(\d+)/i);
  if (rnoMatch) raw.report_no = parseInt(rnoMatch[1], 10);
  const grpMatch = flat.match(/Group:\s*([A-Za-z0-9\s]+?)(?:\s+\d{1,2}\s+Jun|\s+29)/i);
  if (grpMatch) raw.pos_group = grpMatch[1].trim();

  assignPair(raw, 'item_sales', qtyAmountAfter(flat, /Item\s*Sales|ItenSales/i, /ItemDiscount|BillDiscount/i, 1_000_000, 100_000_000));
  assignPair(raw, 'item_discount', qtyAmountAfter(flat, /ItemDiscount/i, /BillDiscount|FOC/i, 1_000, 50_000_000));
  assignPair(raw, 'cash', qtyAmountAfter(flat, /\bCASH\b/i, /\bBCA\b/i, 1_000, 100_000_000));
  assignPair(raw, 'bca', qtyAmountAfter(flat, /\bBCA\b/i, /GOJEK|MANDIRI/i, 1_000, 100_000_000));
  assignPair(raw, 'gojek_pay', qtyAmountAfter(flat, /\bGOJEK\b/i, /MANDIRI/i, 1_000, 50_000_000));
  assignPair(raw, 'mandiri', qtyAmountAfter(flat, /\bMANDIRI\b/i, /TOTAL\s*CARD/i, 1_000, 100_000_000));
  assignPair(raw, 'total_card', qtyAmountAfter(flat, /TOTAL\s*CARD/i, /TOTAL\s*CASH/i, 1_000, 100_000_000));
  assignPair(raw, 'total_cash', qtyAmountAfter(flat, /TOTAL\s*CASH/i, /Refund|VOID/i, 1_000, 100_000_000));
  assignPair(raw, 'pre_send_void', qtyAmountAfter(flat, /Pre[\s-]*Send\s*Void/i, /Post[\s-]*Send|TotCollection/i, 10_000, 10_000_000));
  assignPair(raw, 'tot_collection', qtyAmountAfter(flat, /TotCollection/i, /TAX|Tax/i, 1_000, 100_000_000));

  raw.total_sales = firstIdrAfterLabel(flat, /Total\s*Sales/i, 120, 8_000_000, 80_000_000) || findRepeatedAmount(flat);
  raw.estimated_sales = firstIdrAfterLabel(flat, /Estimated\s*Sales/i, 80, 8_000_000, 80_000_000) || raw.total_sales;
  raw.nett_sales = firstIdrAfterLabel(flat, /Nett\s*Sales/i, 200, 8_000_000, 80_000_000) || raw.total_sales;
  raw.tax_10_amount = firstLooseIdrAfterLabel(flat, /Tax\s*10\s*%/i, 60, 100_000, 20_000_000);
  raw.service_7_amount = firstLooseIdrAfterLabel(flat, /Service\s*7\s*%/i, 60, 100_000, 20_000_000);

  const seq = flat.match(/(?:^|\s)(\d{1,3})\s+([\d,]+(?:\.\d{1,2})?)\s+(\d{1,4})\s+([\d,]+(?:\.\d{1,2})?)/);
  if (seq) {
    raw.total_bills = parseInt(seq[1], 10);
    raw.avg_bills = parseIdrAmount(seq[2]);
    raw.total_covers = parseInt(seq[3], 10);
    raw.avg_covers = parseIdrAmount(seq[4]);
  }

  const beginRcpt = flat.match(/Begin\s*Receipt[#H]?\s*([A-Z]\d+)/i);
  if (beginRcpt) raw.begin_receipt_no = beginRcpt[1];
  const endRcpt = flat.match(/End\s*Receipt[#i]?\s*([A-Z]\d+)/i);
  if (endRcpt) raw.end_receipt_no = endRcpt[1];

  assignPair(raw, 'group_beverage', qtyAmountAfter(flat, /GROUP\s*SALES[\s\S]*?BEVERAGE|BEVERAGE/i, /FOOD|TOTAL\s*GROUP/i, 100_000, 50_000_000));
  assignPair(raw, 'group_food', qtyAmountAfter(flat, /GROUP\s*SALES[\s\S]*?FOOD|\bFOOD\b/i, /TOTAL\s*GROUP|GROUP\s*FOC/i, 100_000, 50_000_000));
  assignPair(raw, 'group_total', qtyAmountAfter(flat, /TOTAL\s*GROUP/i, /GROUP\s*FOC|SALES\s*CATEGORY/i, 1_000_000, 100_000_000));
  assignPair(raw, 'dine_in', qtyAmountAfter(flat, /DINE\s*IN/i, /GO[\s-]*FOOD/i, 1_000_000, 80_000_000));
  assignPair(raw, 'gofood', qtyAmountAfter(flat, /GO[\s-]*FOOD/i, /TOTAL\s*CTGRY|DISCOUNT/i, 10_000, 50_000_000));
  assignPair(raw, 'total_ctgry', qtyAmountAfter(flat, /TOTAL\s*CTGRY/i, /DISCOUNT/i, 1_000_000, 100_000_000));
  assignPair(raw, 'bill_disc_20', qtyAmountAfter(flat, /BILL\s*DISC\s*20/i, /TOTAL\s*ItemDiscount/i, 1_000, 50_000_000));
  assignPair(raw, 'total_item_discount', qtyAmountAfter(flat, /TOTAL\s*ItemDiscount/i, /\d{2}\/\d{2}\/\d{4}|$/i, 1_000, 50_000_000));

  let confidence = 'low';
  if (raw.nett_sales && raw.total_covers && raw.report_date) confidence = 'high';
  else if (raw.nett_sales || raw.total_covers) confidence = 'medium';

  return sanitizeExtraction({ ...raw, confidence, method: 'heuristic' });
}

function parsePosDateTime(s) {
  const m = String(s).match(/(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}`;
}

function toInt(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) return Math.round(val);
  return parseIdrAmount(val);
}

export function sanitizeExtraction(raw) {
  const out = { confidence: raw.confidence || 'medium', method: raw.method || 'unknown' };

  for (const key of Z_REPORT_FIELD_KEYS) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') {
      if (key === 'report_date') out[key] = String(raw[key]).slice(0, 10);
      else if (key === 'report_time') out[key] = String(raw[key]).slice(0, 8);
      else if (['operator', 'pos_group', 'begin_receipt_no', 'end_receipt_no'].includes(key)) {
        out[key] = String(raw[key]).trim();
      }       else if (key === 'period_start' || key === 'period_end') {
        const normalized = toPeriodApiValue(raw[key]);
        if (normalized) out[key] = normalized;
      } else if (key.endsWith('_qty') || key === 'report_no' || key === 'total_bills' || key === 'total_covers') {
        out[key] = toInt(raw[key]);
      } else if (
        key.endsWith('_amount') || key === 'total_sales' || key === 'estimated_sales'
        || key === 'nett_sales' || key === 'avg_bills' || key === 'avg_covers'
      ) {
        out[key] = toInt(raw[key]);
      }
    }
  }

  // Fallbacks for missing fields
  if (!out.report_date && raw.date) out.report_date = raw.date.slice(0, 10);
  if (!out.nett_sales && raw.revenue) out.nett_sales = toInt(raw.revenue);
  if (!out.total_sales && raw.revenue) out.total_sales = toInt(raw.revenue);
  if (!out.total_covers && out.item_sales_qty) out.total_covers = out.item_sales_qty;
  if (!out.total_covers && raw.guests_count) out.total_covers = toInt(raw.guests_count);
  if (!out.avg_covers && raw.avg_spend) out.avg_covers = toInt(raw.avg_spend);
  if (!out.gofood_amount && raw.gofood_revenue) out.gofood_amount = toInt(raw.gofood_revenue);
  if (!out.dine_in_amount && raw.dine_in_revenue) out.dine_in_amount = toInt(raw.dine_in_revenue);
  if (!out.total_bills && raw.bills_count) out.total_bills = toInt(raw.bills_count);
  if (!out.total_item_discount_amount && raw.discounts) out.total_item_discount_amount = toInt(raw.discounts);
  if (!out.pre_send_void_amount && raw.voids) out.pre_send_void_amount = toInt(raw.voids);

  if (!out.avg_covers && out.nett_sales && out.total_covers) {
    out.avg_covers = Math.round(out.nett_sales / out.total_covers);
  }

  return out;
}

export function mergeExtractions(primary, secondary) {
  if (!secondary) return primary;
  const out = { ...primary };
  for (const key of [...Z_REPORT_FIELD_KEYS, 'confidence', 'method']) {
    if ((out[key] == null || out[key] === '') && secondary[key] != null && secondary[key] !== '') {
      out[key] = secondary[key];
    }
  }
  if (secondary.confidence === 'high') out.confidence = 'high';
  out.method = [primary.method, secondary.method].filter(Boolean).join('+');
  return out;
}

export async function extractPosWithAi(text, apiKey) {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: POS_EXTRACTION_PROMPT },
        { role: 'user', content: `Extract all Z-report fields:\n\n${text.slice(0, 14000)}` },
      ],
      max_tokens: 2500,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI error ${resp.status}: ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('No extraction result');
  return sanitizeExtraction({ ...JSON.parse(content), method: 'ai' });
}
