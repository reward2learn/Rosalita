import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { baseQuery } from '@/store/base-query';
import { metricsApi } from '@/store/apis/metrics-api';

describe('RTK Query client conventions', () => {
  it('baseQuery uses cookie credentials', () => {
    expect(baseQuery).toBeDefined();
    const configPath = join(process.cwd(), 'src/store/base-query.ts');
    const source = readFileSync(configPath, 'utf8');
    expect(source).toContain("credentials: 'include'");
    expect(source).not.toMatch(/headers\s*:\s*\{[^}]*x-admin-key/i);
  });

  it('metricsApi saveZReport mutation does not set x-admin-key', () => {
    const endpoint = metricsApi.endpoints.saveZReport;
    const def = endpoint.initiate({ report_date: '2026-06-01', department: 'all_pos' });
    expect(def).toBeDefined();
    const source = readFileSync(
      join(process.cwd(), 'src/store/apis/metrics-api.ts'),
      'utf8',
    );
    expect(source.toLowerCase()).not.toContain('x-admin-key');
  });
});
