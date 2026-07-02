#!/usr/bin/env node
/**
 * Local Chromium PDF smoke test — mirrors /api/pdf behaviour.
 * Usage: node scripts/test-pdf.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 3456;
const BASE = process.argv[2] || `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

function startStaticServer() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      let path = req.url?.split('?')[0] || '/';
      if (path === '/') path = '/index.html';
      const file = join(ROOT, path.replace(/^\//, ''));
      if (!file.startsWith(ROOT) || !existsSync(file)) {
        res.writeHead(404);
        return res.end('Not found');
      }
      const ext = extname(file);
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
].filter(Boolean);

const executablePath = CHROME_PATHS.find((p) => existsSync(p));
if (!executablePath) {
  console.error('No Chrome found');
  process.exit(1);
}

let server;
if (BASE.includes(`127.0.0.1:${PORT}`)) {
  server = await startStaticServer();
}

const url = `${BASE.replace(/\/$/, '')}/index.html?pdf=1`;
console.log('Rendering', url);

const browser = await puppeteer.launch({
  executablePath,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
  defaultViewport: { width: 816, height: 1056, deviceScaleFactor: 1 },
});

try {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.waitForSelector('#pdfCapture');
  const pdf = await page.pdf({
    format: 'Letter',
    printBackground: true,
    margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
  });
  const out = join(ROOT, '.tmp', 'test-export.pdf');
  writeFileSync(out, pdf);
  console.log('Wrote', out, `(${(pdf.length / 1024).toFixed(1)} KB)`);

  const box = await page.evaluate(() => {
    const el = document.getElementById('pdfCapture');
    const r = el.getBoundingClientRect();
    return { width: r.width, left: r.left, scrollWidth: el.scrollWidth };
  });
  console.log('pdfCapture layout:', box);
} finally {
  await browser.close();
  if (server) server.close();
}
