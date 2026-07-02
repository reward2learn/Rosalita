import { describe, expect, it } from 'vitest';
import {
  hasAnyUpload,
  validateExcelUpload,
  validateMarkdownUpload,
} from '@/lib/config/upload-validation';

describe('upload validation', () => {
  it('accepts valid xlsx', () => {
    const file = new File(['data'], 'cashflow.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    expect(validateExcelUpload(file)).toBeNull();
  });

  it('rejects invalid excel extension', () => {
    const file = new File(['data'], 'cashflow.pdf', { type: 'application/pdf' });
    expect(validateExcelUpload(file)).toMatch(/xlsx/i);
  });

  it('accepts markdown files', () => {
    const file = new File(['# Title'], 'review.md', { type: 'text/markdown' });
    expect(validateMarkdownUpload(file, 'Business Review')).toBeNull();
  });

  it('detects when any file selected', () => {
    expect(hasAnyUpload({})).toBe(false);
    expect(
      hasAnyUpload({
        excel: new File(['x'], 'a.xlsx'),
      }),
    ).toBe(true);
  });
});
