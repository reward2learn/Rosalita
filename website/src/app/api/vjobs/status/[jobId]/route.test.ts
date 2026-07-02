import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/db', () => ({
  createClient: vi.fn(() => ({})),
}));

vi.mock('@/domain/pdf/pdf-export-service', () => ({
  PdfExportService: vi.fn().mockImplementation(() => ({
    getJobStatus: vi.fn().mockResolvedValue({ status: 'PENDING' }),
    processJob: vi.fn().mockResolvedValue({ status: 'COMPLETED', pdfBase64: 'JVBERi0=' }),
  })),
}));

describe('GET /api/vjobs/status/[jobId]', () => {
  it('returns job status shape for pending jobs', async () => {
    const response = await GET(
      new Request('http://localhost/api/vjobs/status/job-abc'),
      { params: Promise.resolve({ jobId: 'job-abc' }) },
    );
    expect(response.status).toBe(200);
    const json = await response.json() as { success: boolean; status: string; pdfBase64?: string };
    expect(json.success).toBe(true);
    expect(json.status).toBe('COMPLETED');
    expect(json.pdfBase64).toBe('JVBERi0=');
  });

  it('returns 404 when job not found', async () => {
    const { PdfExportService } = await import('@/domain/pdf/pdf-export-service');
    vi.mocked(PdfExportService).mockImplementationOnce(() => ({
      getJobStatus: vi.fn().mockResolvedValue(null),
      processJob: vi.fn(),
    }) as never);

    const response = await GET(
      new Request('http://localhost/api/vjobs/status/missing'),
      { params: Promise.resolve({ jobId: 'missing' }) },
    );
    expect(response.status).toBe(404);
  });
});
