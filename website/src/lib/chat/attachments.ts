/**
 * Shared chat attachment types + helpers used by both the client (chat panel /
 * store slice) and the server (chat route + conversation persistence).
 *
 * An attachment carries the original file's base64 data so images can be sent
 * to the vision model and re-rendered when a conversation is reloaded, plus
 * optional extracted text for spreadsheets (CSV / XLSX).
 */

export type ChatAttachmentKind = 'image' | 'spreadsheet' | 'document';

export interface ChatAttachment {
  /** Original file name. */
  name: string;
  /** MIME type reported by the browser (may be empty for some CSV files). */
  mimeType: string;
  /** File size in bytes. */
  size: number;
  /** Coarse classification used for rendering + prompt building. */
  kind: ChatAttachmentKind;
  /** Base64-encoded file bytes (no data-URL prefix). Omitted if too large to embed. */
  dataBase64?: string;
  /** Plain-text extracted from CSV / XLSX files. */
  extractedText?: string;
  /** True when the binary payload was dropped for exceeding the embed limit. */
  truncated?: boolean;
}

/** Max bytes we embed as base64 in the message metadata (~4MB raw ≈ 5.3MB base64). */
export const MAX_EMBED_BYTES = 4 * 1024 * 1024;

/** Max characters of extracted spreadsheet text kept in metadata / prompt. */
export const MAX_EXTRACTED_TEXT_CHARS = 20_000;

/** Overall ceiling for a single selected file (reject larger before reading). */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

const SPREADSHEET_MIME = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

const SPREADSHEET_EXT = /\.(csv|xlsx|xls)$/i;

export function classifyAttachment(name: string, mimeType: string): ChatAttachmentKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (SPREADSHEET_MIME.has(mimeType) || SPREADSHEET_EXT.test(name)) return 'spreadsheet';
  return 'document';
}

export function isSpreadsheet(name: string, mimeType: string): boolean {
  return classifyAttachment(name, mimeType) === 'spreadsheet';
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Build a `data:` URL for rendering an embedded image attachment. */
export function attachmentDataUrl(attachment: ChatAttachment): string | null {
  if (!attachment.dataBase64) return null;
  const mime = attachment.mimeType || 'application/octet-stream';
  return `data:${mime};base64,${attachment.dataBase64}`;
}

/**
 * Render a compact text description of an attachment for the LLM prompt. Images
 * are handled separately (as vision parts), so this is mainly for spreadsheets
 * and generic documents.
 */
export function describeAttachmentForPrompt(attachment: ChatAttachment): string {
  const header = `File "${attachment.name}" (${attachment.mimeType || 'unknown type'}, ${formatFileSize(attachment.size)})`;
  if (attachment.extractedText) {
    return `${header} — extracted contents:\n${attachment.extractedText}`;
  }
  if (attachment.kind === 'image') {
    return `${header} — attached as an image (see vision input).`;
  }
  return `${header} — binary file attached (contents not extracted).`;
}

/** Zod-free runtime guard for a plausibly-valid attachment coming over the wire. */
export function isChatAttachment(value: unknown): value is ChatAttachment {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string'
    && typeof v.mimeType === 'string'
    && typeof v.size === 'number'
    && (v.kind === 'image' || v.kind === 'spreadsheet' || v.kind === 'document');
}
