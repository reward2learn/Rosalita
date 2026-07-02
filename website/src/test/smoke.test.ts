import { describe, it, expect } from 'vitest';
import { PAGE_CATALOG } from '@/lib/page-catalog';

describe('migration scaffold', () => {
  it('page catalog defines dashboard slug', () => {
    expect(PAGE_CATALOG.dashboard).toBeDefined();
    expect(PAGE_CATALOG.dashboard.slug).toBe('dashboard');
  });
});
