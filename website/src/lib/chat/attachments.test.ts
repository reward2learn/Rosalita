import { describe, expect, it } from 'vitest';
import {
  attachmentDataUrl,
  classifyAttachment,
  describeAttachmentForPrompt,
  isChatAttachment,
  isSpreadsheet,
  type ChatAttachment,
} from './attachments';

describe('classifyAttachment', () => {
  it('classifies images by mime type', () => {
    expect(classifyAttachment('photo.png', 'image/png')).toBe('image');
  });

  it('classifies spreadsheets by mime or extension', () => {
    expect(classifyAttachment('data.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')).toBe('spreadsheet');
    expect(classifyAttachment('export.csv', '')).toBe('spreadsheet');
    expect(isSpreadsheet('legacy.xls', 'application/vnd.ms-excel')).toBe(true);
  });

  it('falls back to document', () => {
    expect(classifyAttachment('notes.pdf', 'application/pdf')).toBe('document');
  });
});

describe('attachmentDataUrl', () => {
  it('builds a data url when base64 present', () => {
    const attachment: ChatAttachment = {
      name: 'a.png', mimeType: 'image/png', size: 3, kind: 'image', dataBase64: 'aGk=',
    };
    expect(attachmentDataUrl(attachment)).toBe('data:image/png;base64,aGk=');
  });

  it('returns null without base64', () => {
    const attachment: ChatAttachment = { name: 'a.png', mimeType: 'image/png', size: 3, kind: 'image' };
    expect(attachmentDataUrl(attachment)).toBeNull();
  });
});

describe('describeAttachmentForPrompt', () => {
  it('includes extracted text for spreadsheets', () => {
    const attachment: ChatAttachment = {
      name: 'sales.csv', mimeType: 'text/csv', size: 10, kind: 'spreadsheet', extractedText: 'a,b\n1,2',
    };
    expect(describeAttachmentForPrompt(attachment)).toContain('extracted contents');
    expect(describeAttachmentForPrompt(attachment)).toContain('a,b');
  });
});

describe('isChatAttachment', () => {
  it('validates shape', () => {
    expect(isChatAttachment({ name: 'x', mimeType: 'image/png', size: 1, kind: 'image' })).toBe(true);
    expect(isChatAttachment({ name: 'x', kind: 'image' })).toBe(false);
    expect(isChatAttachment(null)).toBe(false);
  });
});
