import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, resolve } from 'node:path';

export const SOURCE_FILENAMES = {
  excel: 'Rosallita Cashflow May 24th 2026.xlsx',
  businessReview: 'Rosalita Business Review — June 2026.md',
  executiveSummary: 'Rosalita Executive Summary — June 2026.md',
} as const;

export type SourceFileKey = keyof typeof SOURCE_FILENAMES;

const WEBSITE_ROOT = resolve(process.cwd());
const DEFAULT_REPO_ROOT = resolve(WEBSITE_ROOT, '..');

export function getWebsiteRoot(): string {
  return WEBSITE_ROOT;
}

export function getDefaultRepoRoot(): string {
  return DEFAULT_REPO_ROOT;
}

/** Directory for persisted source files (repo root locally, /tmp on Vercel unless overridden). */
export function getSourceDir(): string {
  if (process.env.ROSALITA_SOURCE_DIR) {
    return resolve(process.env.ROSALITA_SOURCE_DIR);
  }
  const repoRoot = DEFAULT_REPO_ROOT;
  if (sourceFileExists('excel', repoRoot)) {
    return repoRoot;
  }
  if (process.env.VERCEL === '1' && process.env.VERCEL_REGION) {
    return '/tmp/rosalita-sources';
  }
  return repoRoot;
}

export function sourceFilePath(key: SourceFileKey, sourceDir = getSourceDir()): string {
  const filename = SOURCE_FILENAMES[key];
  const resolvedDir = resolve(sourceDir);
  const resolvedPath = resolve(resolvedDir, filename);
  if (!resolvedPath.startsWith(resolvedDir)) {
    throw new Error('Invalid source file path');
  }
  return resolvedPath;
}

export function ensureSourceDir(sourceDir = getSourceDir()): string {
  const dir = resolve(sourceDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function readSourceFile(key: SourceFileKey, sourceDir = getSourceDir()): Buffer {
  const path = sourceFilePath(key, sourceDir);
  if (!existsSync(path)) {
    throw new Error(`Missing source file: ${basename(path)}`);
  }
  return readFileSync(path);
}

export function readSourceText(key: SourceFileKey, sourceDir = getSourceDir()): string {
  return readSourceFile(key, sourceDir).toString('utf8');
}

export function writeSourceFile(
  key: SourceFileKey,
  data: Buffer | string,
  sourceDir = getSourceDir(),
): string {
  const dir = ensureSourceDir(sourceDir);
  const path = sourceFilePath(key, dir);
  const buffer = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
  writeFileSync(path, buffer);
  return path;
}

export function sourceFileExists(key: SourceFileKey, sourceDir = getSourceDir()): boolean {
  return existsSync(sourceFilePath(key, sourceDir));
}

export const TERMS_HTML_PATH = resolve(WEBSITE_ROOT, 'terms-of-service.html');
export const PRIVACY_HTML_PATH = resolve(WEBSITE_ROOT, 'privacy-policy.html');
