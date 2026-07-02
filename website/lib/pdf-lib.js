/**
 * Chromium PDF generation — used by GET /api/auth?action=pdf
 */
import chromium from '@sparticuz/chromium';
import puppeteer from 'puppeteer-core';
import { existsSync } from 'node:fs';

export const PDF_FILENAME = 'Rosalita-Business-Review-June-2026.pdf';

const LOCAL_CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
].filter(Boolean);

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
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
  });
}

export async function generateDashboardPdf(origin, cookieHeader, pagePath = '/index.html') {
  const targetUrl = `${origin}${pagePath}?pdf=1`;
  const browser = await launchBrowser();

  try {
    const page = await browser.newPage();
    if (cookieHeader) {
      await page.setExtraHTTPHeaders({ cookie: cookieHeader });
    }
    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 45000 });
    await page.waitForSelector('#pdfCapture', { timeout: 15000 });
    await page.evaluate(() => document.fonts?.ready);

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
