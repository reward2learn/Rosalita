import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';
import { Buffer } from 'node:buffer';
import type { DbClient } from '@/lib/db';
import type { JobStatus } from '@/generated/prisma';

export const PDF_FILENAME = 'Rosalita-Business-Review-June-2026.pdf';

const LOCAL_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter((p): p is string => Boolean(p));

export interface PdfJobPayload {
  origin: string;
  sessionCookie?: string;
  pagePath?: string;
}

export interface PdfJobResult {
  status: JobStatus;
  pdfBase64?: string;
  filename?: string;
  details?: string;
}

async function launchBrowser() {
  if (process.env.VERCEL) {
    return puppeteer.launch({
      args: chromium.args,
      defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });
  }

  const executablePath = LOCAL_CHROME_PATHS.find((p) => existsSync(p));
  if (!executablePath) {
    throw new Error('No local Chrome/Chromium found. Set CHROME_PATH or install Google Chrome.');
  }

  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
  });
}

export async function generateDashboardPdf(
  origin: string,
  cookieHeader: string,
  pagePath = '/index.html',
): Promise<Uint8Array> {
  const targetUrl = `${origin}${pagePath}?pdf=1`;
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 45_000 });
    await page.waitForSelector('#pdfCapture', { timeout: 15_000 });
    await page.evaluate('document.fonts && document.fonts.ready');

    return await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: false,
      margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
    });
  } finally {
    await browser.close().catch(() => {});
  }
}

export class PdfExportService {
  constructor(private readonly db: DbClient) {}

  async queueJob(
    sessionId: string,
    payload: PdfJobPayload,
  ): Promise<string> {
    const job = await this.db.pdfJob.create({
      data: {
        requestedBySession: sessionId,
        payload: payload as object,
        status: 'PENDING',
      },
    });
    return job.jobId;
  }

  async getJobStatus(jobId: string): Promise<PdfJobResult | null> {
    const row = await this.db.pdfJob.findUnique({ where: { jobId } });
    if (!row) return null;

    if (row.status === 'COMPLETED' && row.completedData) {
      const data = row.completedData as { pdfBase64?: string; filename?: string };
      return {
        status: row.status,
        pdfBase64: data.pdfBase64,
        filename: data.filename ?? PDF_FILENAME,
      };
    }

    if (row.status === 'FAILED' && row.completedData) {
      const data = row.completedData as { error?: string };
      return { status: row.status, details: data.error };
    }

    return { status: row.status };
  }

  async claimPendingJob(jobId: string): Promise<{ jobId: string; payload: PdfJobPayload } | null> {
    const updated = await this.db.pdfJob.updateMany({
      where: { jobId, status: 'PENDING' },
      data: { status: 'PROCESSING' },
    });
    if (!updated.count) return null;

    const row = await this.db.pdfJob.findUnique({ where: { jobId } });
    if (!row) return null;
    return { jobId: row.jobId, payload: row.payload as unknown as PdfJobPayload };
  }

  async processJob(jobId: string): Promise<PdfJobResult> {
    const claimed = await this.claimPendingJob(jobId);
    if (!claimed) {
      const existing = await this.getJobStatus(jobId);
      return existing ?? { status: 'FAILED', details: 'Job not found or already processing' };
    }

    try {
      const pdfBuffer = await generateDashboardPdf(
        claimed.payload.origin,
        claimed.payload.sessionCookie ?? '',
        claimed.payload.pagePath ?? '/index.html',
      );
      const base64Pdf = Buffer.from(pdfBuffer).toString('base64');
      const completedData = { pdfBase64: base64Pdf, filename: PDF_FILENAME };

      await this.db.pdfJob.update({
        where: { jobId },
        data: { status: 'COMPLETED', completedData },
      });

      return { status: 'COMPLETED', pdfBase64: base64Pdf, filename: PDF_FILENAME };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.db.pdfJob.update({
        where: { jobId },
        data: { status: 'FAILED', completedData: { error: message } },
      });
      return { status: 'FAILED', details: message };
    }
  }
}
