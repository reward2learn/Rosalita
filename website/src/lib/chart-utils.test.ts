import { describe, expect, it } from 'vitest';
import {
  parseMonthQueryParam,
  resolveDefaultMonthIndex,
  resolveMonthIndex,
} from '@/lib/chart-utils';

describe('chart-utils month helpers', () => {
  const labels = ['Jan 2026', 'Feb 2026', 'Aug 2026'];

  it('decodes month query params with plus-encoded spaces', () => {
    expect(parseMonthQueryParam('Aug+2026')).toBe('Aug 2026');
    expect(parseMonthQueryParam('Aug 2026')).toBe('Aug 2026');
    expect(parseMonthQueryParam(null)).toBeNull();
  });

  it('resolves default month index to current calendar month when present', () => {
    const julLabels = ['Jan 2026', 'Jul 2026', 'Aug 2026'];
    expect(resolveDefaultMonthIndex(julLabels)).toBe(1);
    expect(resolveDefaultMonthIndex(['Jan 2026'])).toBe(0);
  });

  it('resolves selected month index from labels', () => {
    expect(resolveMonthIndex(labels, 'Aug 2026')).toBe(2);
    expect(resolveMonthIndex(labels, 'Missing 2026')).toBe(0);
  });
});
