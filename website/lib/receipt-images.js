/**
 * POS receipt image storage helpers (JSONB on daily_z_reports).
 * Images stored as { mime, data (base64), name, captured_at } — max 3 per day.
 */

export const MAX_IMAGES = 3;
const MAX_B64_LEN = 750_000; // ~550KB decoded

export function imageToDataUrl(img) {
  if (!img || !img.data) return '';
  if (String(img.data).startsWith('data:')) return img.data;
  const mime = img.mime || 'image/jpeg';
  return `data:${mime};base64,${img.data}`;
}

export function sanitizeReceiptImages(images) {
  if (!images) return [];
  if (typeof images === 'string') {
    try {
      images = JSON.parse(images);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(images)) return [];

  const out = [];
  for (let i = 0; i < Math.min(images.length, MAX_IMAGES); i++) {
    const img = images[i];
    if (!img) continue;
    let data = img.data || '';
    if (!data && img.dataUrl) {
      const parts = String(img.dataUrl).split(',');
      data = parts.length > 1 ? parts[1] : parts[0];
    }
    data = String(data).trim();
    if (!data) continue;
    if (data.length > MAX_B64_LEN) {
      throw new Error(`Receipt image ${i + 1} is too large (max ~500KB each)`);
    }
    out.push({
      mime: img.mime || 'image/jpeg',
      data,
      name: img.name || `receipt-${i + 1}.jpg`,
      captured_at: img.captured_at || new Date().toISOString(),
    });
  }
  return out;
}

/**
 * Once a day has receipt images on file, they cannot be removed or replaced — only appended.
 */
export function mergeReceiptImages(existing, incoming) {
  const existingSanitized = sanitizeReceiptImages(existing);
  const incomingSanitized = sanitizeReceiptImages(incoming);

  if (!existingSanitized.length) return incomingSanitized;

  const existingData = new Set(existingSanitized.map((img) => img.data));
  for (const img of existingSanitized) {
    if (!incomingSanitized.some((inc) => inc.data === img.data)) {
      throw new Error(
        'Saved receipt images cannot be removed or replaced. You may only add new images.',
      );
    }
  }

  const merged = [...existingSanitized];
  for (const img of incomingSanitized) {
    if (!existingData.has(img.data)) {
      merged.push(img);
      existingData.add(img.data);
    }
  }
  return merged.slice(0, MAX_IMAGES);
}

export function stripReceiptImages(row) {
  if (!row) return row;
  const r = { ...row };
  const imgs = r.receipt_images;
  r.receipt_image_count = Array.isArray(imgs)
    ? imgs.length
    : (typeof imgs === 'string' ? (() => { try { return JSON.parse(imgs).length; } catch { return 0; } })() : 0);
  delete r.receipt_images;
  return r;
}
