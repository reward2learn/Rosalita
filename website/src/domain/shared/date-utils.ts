/** Normalize report_date / DATE values to YYYY-MM-DD. */
export function toIsoDate(val: unknown): string {
  if (val == null || val === '') return '';

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const s = String(val).trim();
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1]!;

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/** PostgreSQL TIMESTAMP string: YYYY-MM-DD HH:mm:ss */
export function toSqlTimestamp(val: unknown): string {
  const local = toDatetimeLocal(val);
  if (!local) return '';
  const withSeconds = local.length === 16 ? `${local}:00` : local.slice(0, 19).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(withSeconds)) return withSeconds;
  return `${local.replace('T', ' ')}:00`;
}

function toDatetimeLocal(val: unknown): string {
  if (val == null || val === '') return '';

  if (val instanceof Date) {
    if (Number.isNaN(val.getTime())) return '';
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    const h = String(val.getHours()).padStart(2, '0');
    const mi = String(val.getMinutes()).padStart(2, '0');
    return `${y}-${m}-${d}T${h}:${mi}`;
  }

  const s = String(val).trim();

  let m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})/);
  if (m) return `${m[1]}T${m[2]}:${m[3]}`;

  m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}`;

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    return toDatetimeLocal(parsed);
  }

  return '';
}

/** Normalized period value for API JSON (ISO local with seconds). */
export function toPeriodApiValue(val: unknown): string {
  const sql = toSqlTimestamp(val);
  if (!sql) return '';
  return sql.replace(' ', 'T');
}

export function periodFromDate(dateStr: string): string {
  return String(dateStr).slice(0, 7);
}

export function monthBounds(period: string): {
  start: string;
  end: string;
  year: number;
  month: number;
  daysInMonth: number;
} {
  const [y, m] = period.split('-').map(Number);
  const start = `${period}-01`;
  const nextM = m === 12 ? 1 : m + 1;
  const nextY = m === 12 ? y + 1 : y;
  const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
  return { start, end, year: y, month: m, daysInMonth: new Date(y, m, 0).getDate() };
}
