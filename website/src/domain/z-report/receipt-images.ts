export const MAX_IMAGES = 3;
const MAX_B64_LEN = 750_000;

export interface ReceiptImage {
  mime: string;
  data: string;
  name: string;
  captured_at: string;
}

export function imageToDataUrl(img: Partial<ReceiptImage> | null | undefined): string {
  if (!img?.data) return '';
  if (String(img.data).startsWith('data:')) return img.data;
  const mime = img.mime || 'image/jpeg';
  return `data:${mime};base64,${img.data}`;
}

export function sanitizeReceiptImages(images: unknown): ReceiptImage[] {
  if (!images) return [];
  let list: unknown = images;
  if (typeof images === 'string') {
    try {
      list = JSON.parse(images);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];

  const out: ReceiptImage[] = [];
  for (let i = 0; i < Math.min(list.length, MAX_IMAGES); i++) {
    const img = list[i] as Record<string, unknown> | null | undefined;
    if (!img) continue;
    let data = String(img.data ?? '');
    if (!data && img.dataUrl) {
      const parts = String(img.dataUrl).split(',');
      data = parts.length > 1 ? parts[1]! : parts[0]!;
    }
    data = data.trim();
    if (!data) continue;
    if (data.length > MAX_B64_LEN) {
      throw new Error(`Receipt image ${i + 1} is too large (max ~500KB each)`);
    }
    out.push({
      mime: String(img.mime ?? 'image/jpeg'),
      data,
      name: String(img.name ?? `receipt-${i + 1}.jpg`),
      captured_at: String(img.captured_at ?? new Date().toISOString()),
    });
  }
  return out;
}

export function mergeReceiptImages(existing: unknown, incoming: unknown): ReceiptImage[] {
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

export function stripReceiptImages<T extends Record<string, unknown>>(
  row: T | null,
): (T & { receipt_image_count?: number }) | null {
  if (!row) return row;
  const r = { ...row } as T & { receipt_image_count?: number };
  const imgs = r.receipt_images ?? r.receiptImages;
  r.receipt_image_count = Array.isArray(imgs)
    ? imgs.length
    : typeof imgs === 'string'
      ? (() => {
          try {
            return (JSON.parse(imgs) as unknown[]).length;
          } catch {
            return 0;
          }
        })()
      : 0;
  delete r.receipt_images;
  delete r.receiptImages;
  return r;
}
