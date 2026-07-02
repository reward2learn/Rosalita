import type { Decimal } from '@prisma/client/runtime/library';

export function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  if (typeof v === 'object' && v !== null && 'toNumber' in v) {
    const n = (v as Decimal).toNumber();
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Full IDR integer from DB Decimal or number. */
export function toIdrInt(v: unknown): number {
  const n = num(v);
  return n == null ? 0 : Math.round(n);
}

export function snakeToCamel(key: string): string {
  return key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
}
