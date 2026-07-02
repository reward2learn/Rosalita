/**
 * Normalize report_date / DATE values to YYYY-MM-DD.
 * Handles ISO strings, PG Date objects from Neon, and legacy formats.
 */
export function toIsoDate(val) {
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
  if (iso) return iso[1];

  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getUTCFullYear();
    const m = String(parsed.getUTCMonth() + 1).padStart(2, '0');
    const d = String(parsed.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return '';
}

/** `input[type=datetime-local]` value: YYYY-MM-DDTHH:mm */
export function toDatetimeLocal(val) {
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

/** PostgreSQL TIMESTAMP string: YYYY-MM-DD HH:mm:ss */
export function toSqlTimestamp(val) {
  const local = toDatetimeLocal(val);
  if (!local) return '';
  const withSeconds = local.length === 16 ? `${local}:00` : local.slice(0, 19).replace('T', ' ');
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(withSeconds)) return withSeconds;
  return `${local.replace('T', ' ')}:00`;
}

/** Human display matching POS printout: DD/MM/YYYY HH:mm */
export function formatPeriodDisplay(val) {
  const local = toDatetimeLocal(val);
  if (!local) return val == null || val === '' ? '—' : String(val);
  const [date, time] = local.split('T');
  const [y, mo, d] = date.split('-');
  return `${d}/${mo}/${y} ${time}`;
}

/** Normalized period value for API JSON (ISO local with seconds). */
export function toPeriodApiValue(val) {
  const sql = toSqlTimestamp(val);
  if (!sql) return '';
  return sql.replace(' ', 'T');
}
