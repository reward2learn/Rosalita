// @ts-nocheck — ported from website/lib/expense-extract.js (P3)
import { resolveOpenAiKey } from '@/lib/openai';
import { getActualsDepartment } from '@/domain/actuals/monthly-actuals-schema';
import { parseIdrAmount } from '@/domain/pos/pos-extract';

export function normalizeExpenseText(text) {
  return String(text || '')
    .replace(/[\u200B-\u200D\uFEFF\u00A0\u2028\u2029]/g, '')
    .replace(/[⁃•·\u2022\t]/g, '\n')
    .replace(/\r\n/g, '\n');
}

function fieldMeta(department) {
  const dept = getActualsDepartment(department);
  if (!dept) return [];
  return dept.fields.map((f) => ({ key: f.key, label: f.label, type: f.type }));
}

export function buildExpenseAiPrompt(department) {
  const dept = getActualsDepartment(department);
  const fields = fieldMeta(department);
  const keys = fields.map((f) => `"${f.key}": number|null`).join(', ');
  return `You extract cost amounts from an expense invoice, payroll slip, or payment receipt for Red Ruby Bali.

Cost account: ${dept?.label || department}

Return ONLY valid JSON:
{ ${keys}, confidence: "high"|"medium"|"low" }

Rules:
- Amounts are IDR integers (no commas in JSON numbers).
- Map line items to the most appropriate field key for this account.
- For payroll: map wages to staff_*_cost and headcount to staff_*_count when visible.
- For supplier invoices: map food/beverage/supplies to the matching purchases_* or category field.
- If only one total is visible, put it on the single best-matching amount field for this account.
- Use null when a field is not present on the receipt.`;
}

const LABEL_HINTS = {
  purchases_beverage: [/beverage/i, /minuman/i, /bar\b/i],
  purchases_food: [/food/i, /bahan\s*makanan/i, /grocery/i],
  promoter_costs: [/promoter/i, /influencer/i, /promo/i],
  costs_entertainment: [/entertainment/i, /hiburan/i, /ticket/i, /event/i],
  other_direct: [/direct/i, /supplier/i, /invoice/i],
  staff_mgmt_cost: [/management/i, /manager/i, /gaji\s*manager/i],
  staff_supervisor_cost: [/supervisor/i, /spv/i],
  staff_admin_cost: [/admin/i, /cashier/i, /kasir/i],
  staff_bar_cost: [/bar\s*staff/i, /bartender/i],
  staff_host_cost: [/host/i, /waiter/i, /waitress/i, /server/i, /floor/i],
  staff_marketing_cost: [/marketing/i, /\bgro\b/i],
  staff_kitchen_cost: [/kitchen/i, /koki/i, /chef/i],
  staff_security_cost: [/security/i, /valet/i, /satpam/i],
  staff_store_cost: [/store/i, /cleaning/i, /kebersihan/i],
  staff_daily_cost: [/daily/i, /contract/i, /harian/i],
  staff_travel: [/travel/i, /meal/i, /medical/i, /bpjs/i, /jamsostek/i],
  advertising: [/advertis/i, /promotion/i, /iklan/i],
  marketing_material: [/printing/i, /material/i, /marketing/i],
  rental_equipment: [/rental/i, /equipment/i, /sewa\s*alat/i],
  rents_leases: [/rent/i, /sewa/i, /lease/i],
  repairs: [/repair/i, /maintenance/i, /perbaikan/i],
  electric_gas: [/electric/i, /pln/i, /gas/i, /listrik/i],
  accounting_fees: [/accounting/i, /audit/i, /pajak/i],
  bank_fees: [/bank/i, /card\s*fee/i, /interest/i],
  communication: [/communication/i, /internet/i, /telkom/i, /phone/i],
  legal_permits: [/legal/i, /permit/i, /izin/i, /ceremon/i, /banjar/i],
  sundry: [/sundry/i, /overhead/i, /misc/i],
  travel_accom: [/travel/i, /accommodation/i, /hotel/i, /tiket/i],
};

export function parseExpenseHeuristic(text, department) {
  const fields = fieldMeta(department);
  const out = {};
  const normalized = normalizeExpenseText(text);
  const lines = normalized.split('\n').map((l) => l.trim()).filter(Boolean);

  const totalMatch = normalized.match(
    /(?:grand\s*)?total|jumlah|amount\s*due|total\s*bayar|net\s*amount|sub\s*total/i,
  );
  let totalVal = null;
  if (totalMatch) {
    const idx = normalized.search(totalMatch[0]);
    const slice = normalized.slice(idx, idx + 120);
    const amounts = [...slice.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})/g)]
      .map((m) => parseIdrAmount(m[1]))
      .filter((n) => n != null && n > 0);
    if (amounts.length) totalVal = amounts[amounts.length - 1];
  }

  for (const field of fields) {
    if (field.type === 'int') continue;
    const hints = LABEL_HINTS[field.key] || [];
    for (const line of lines) {
      if (!hints.some((re) => re.test(line))) continue;
      const amounts = [...line.matchAll(/(\d{1,3}(?:[.,]\d{3})+|\d{4,})/g)]
        .map((m) => parseIdrAmount(m[1]))
        .filter((n) => n != null && n > 0);
      if (amounts.length) {
        out[field.key] = amounts[amounts.length - 1];
        break;
      }
    }
  }

  const amountFields = fields.filter((f) => f.type !== 'int');
  if (!Object.keys(out).length && totalVal != null && amountFields.length === 1) {
    out[amountFields[0].key] = totalVal;
  } else if (!Object.keys(out).length && totalVal != null && amountFields.length) {
    out[amountFields[0].key] = totalVal;
  }

  return {
    ...out,
    confidence: Object.keys(out).length ? 'medium' : 'low',
  };
}

export async function parseExpenseWithAi(text, department, apiKey) {
  const prompt = buildExpenseAiPrompt(department);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_PARSE_MODEL || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: text.slice(0, 12000) },
      ],
      max_tokens: 1200,
      temperature: 0.1,
      response_format: { type: 'json_object' },
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`AI parse failed (${resp.status}): ${errText.slice(0, 200)}`);
  }

  const data = await resp.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) throw new Error('Empty AI parse response');
  const parsed = JSON.parse(raw);
  const out = { confidence: parsed.confidence || 'medium' };
  for (const field of fieldMeta(department)) {
    const v = parsed[field.key];
    if (v == null || v === '') continue;
    const n = field.type === 'int' ? Math.round(Number(v)) : parseIdrAmount(v);
    if (n != null && Number.isFinite(n)) out[field.key] = n;
  }
  return out;
}

export async function parseExpenseText(text, department, options = {}) {
  const trimmed = normalizeExpenseText(text).trim();
  if (!trimmed) {
    return { inputs: {}, confidence: 'low' };
  }
  if (!getActualsDepartment(department)) {
    throw new Error('Invalid cost department');
  }

  let result = parseExpenseHeuristic(trimmed, department);
  const inputs = { ...result };
  delete inputs.confidence;

  const needsAi = options.useAi === true
    || result.confidence === 'low'
    || !Object.keys(inputs).length;

  if (needsAi) {
    const apiKey = await resolveOpenAiKey();
    if (apiKey) {
      const ai = await parseExpenseWithAi(trimmed, department, apiKey);
      const conf = ai.confidence;
      delete ai.confidence;
      result = { ...inputs, ...ai, confidence: conf || 'medium' };
    }
  }

  const finalInputs = { ...result };
  delete finalInputs.confidence;
  return {
    inputs: finalInputs,
    confidence: result.confidence || (Object.keys(finalInputs).length ? 'medium' : 'low'),
  };
}
