/**
 * Client-side file reading: converts a browser `File` into a `ChatAttachment`
 * with base64 binary data, and extracts text from CSV / XLSX via the `xlsx`
 * library. Runs only in the browser (uses FileReader).
 */
import {
  classifyAttachment,
  isSpreadsheet,
  MAX_EMBED_BYTES,
  MAX_EXTRACTED_TEXT_CHARS,
  MAX_FILE_BYTES,
  type ChatAttachment,
} from '@/lib/chat/attachments';

export interface ReadAttachmentResult {
  attachment?: ChatAttachment;
  error?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return globalThis.btoa(binary);
}

async function extractSpreadsheetText(buffer: ArrayBuffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sections: string[] = [];
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    if (!sheet) continue;
    const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
    if (csv.trim()) {
      sections.push(`# Sheet: ${sheetName}\n${csv.trim()}`);
    }
  }
  let text = sections.join('\n\n');
  if (text.length > MAX_EXTRACTED_TEXT_CHARS) {
    text = `${text.slice(0, MAX_EXTRACTED_TEXT_CHARS)}\n… [truncated: spreadsheet text exceeded ${MAX_EXTRACTED_TEXT_CHARS} characters]`;
  }
  return text;
}

export async function readFileAsAttachment(file: File): Promise<ReadAttachmentResult> {
  if (file.size > MAX_FILE_BYTES) {
    return {
      error: `"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Max is ${MAX_FILE_BYTES / (1024 * 1024)} MB.`,
    };
  }

  const kind = classifyAttachment(file.name, file.type);
  const buffer = await file.arrayBuffer();

  const attachment: ChatAttachment = {
    name: file.name,
    mimeType: file.type,
    size: file.size,
    kind,
  };

  if (isSpreadsheet(file.name, file.type)) {
    try {
      attachment.extractedText = await extractSpreadsheetText(buffer);
    } catch {
      attachment.extractedText = '[Could not parse spreadsheet contents.]';
    }
  }

  // Embed the raw bytes unless the file is too big; images always need bytes for
  // the thumbnail + vision input, so warn (but still skip) when oversized.
  if (file.size <= MAX_EMBED_BYTES) {
    attachment.dataBase64 = arrayBufferToBase64(buffer);
  } else {
    attachment.truncated = true;
  }

  return { attachment };
}
