export const CONFIG_UPLOAD_FIELD_NAMES = {
  excel: 'excel',
  businessReview: 'businessReview',
  executiveSummary: 'executiveSummary',
} as const;

export const MAX_EXCEL_BYTES = 15 * 1024 * 1024;
export const MAX_MARKDOWN_BYTES = 5 * 1024 * 1024;

const EXCEL_EXTENSIONS = ['.xlsx', '.xls'];
const MARKDOWN_EXTENSIONS = ['.md', '.markdown', '.txt'];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

export function validateExcelUpload(file: File | null | undefined): string | null {
  if (!file || file.size === 0) return null;
  const ext = extensionOf(file.name);
  if (!EXCEL_EXTENSIONS.includes(ext)) {
    return 'Cashflow workbook must be .xlsx or .xls';
  }
  if (file.size > MAX_EXCEL_BYTES) {
    return `Cashflow workbook exceeds ${MAX_EXCEL_BYTES / (1024 * 1024)} MB limit`;
  }
  return null;
}

export function validateMarkdownUpload(
  file: File | null | undefined,
  label: string,
): string | null {
  if (!file || file.size === 0) return null;
  const ext = extensionOf(file.name);
  if (!MARKDOWN_EXTENSIONS.includes(ext)) {
    return `${label} must be a .md file`;
  }
  if (file.size > MAX_MARKDOWN_BYTES) {
    return `${label} exceeds ${MAX_MARKDOWN_BYTES / (1024 * 1024)} MB limit`;
  }
  return null;
}

export function hasAnyUpload(
  files: {
    excel?: File | null;
    businessReview?: File | null;
    executiveSummary?: File | null;
  },
): boolean {
  return Boolean(
    (files.excel && files.excel.size > 0) ||
      (files.businessReview && files.businessReview.size > 0) ||
      (files.executiveSummary && files.executiveSummary.size > 0),
  );
}
