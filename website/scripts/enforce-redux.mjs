#!/usr/bin/env node
/**
 * RTK enforcement gate — P4 hard gate (blocks P6 seed until green).
 *
 * Checks:
 * - No raw fetch() in client components/pages (API routes excluded)
 * - No Zustand imports
 * - No x-admin-key in client code
 * - Store must wire RTK Query API slices
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = new URL('../src', import.meta.url).pathname;
const STORE_INDEX = join(ROOT, 'store/index.ts');
const SCAN_DIRS = ['components', 'app'];

const CLIENT_SCAN_RULES = [
  {
    name: 'DIRECT_FETCH_IN_COMPONENT',
    pattern: /\bfetch\s*\(/,
    severity: 'error',
  },
  { name: 'zustand import', pattern: /from\s+['"]zustand['"]/, severity: 'error' },
  { name: 'x-admin-key header', pattern: /x-admin-key/i, severity: 'error' },
];

let violations = [];

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full);
    } else if (['.tsx', '.ts'].includes(extname(name)) && !name.endsWith('.test.ts') && !name.endsWith('.test.tsx')) {
      const rel = full.replace(ROOT + '/', '');
      // Skip API route handlers (server-side, fetch() is valid for proxy/chaining)
      if (rel.startsWith('app/api/')) continue;
      const text = readFileSync(full, 'utf8');
      // Server Components in app/ use fetch() for data fetching — skip DIRECT_FETCH check
      const isClientComponent = text.includes("'use client'") || text.includes('"use client"');
      const isAppDir = rel.startsWith('app/');
      for (const rule of CLIENT_SCAN_RULES) {
        // Skip DIRECT_FETCH check for server components (Next.js server-side data fetching)
        if (rule.name === 'DIRECT_FETCH_IN_COMPONENT' && isAppDir && !isClientComponent) continue;
        if (rule.pattern.test(text)) {
          violations.push(`${rel}: ${rule.name}`);
        }
      }
    }
  }
}

for (const sub of SCAN_DIRS) {
  walk(join(ROOT, sub));
}

const requiredApis = [
  'authApi',
  'financialApi',
  'metricsApi',
  'monthlyActualsApi',
  'contentApi',
  'chatApi',
  'pdfApi',
  'posApi',
  'configApi',
  'tasksApi',
  'adminApi',
  'dashboardApi',
  'sheetDataApi',
  'brandConfigApi',
  'navigationApi',
];

if (!existsSync(STORE_INDEX)) {
  violations.push('store/index.ts: missing store entry');
} else {
  const storeText = readFileSync(STORE_INDEX, 'utf8');
  for (const api of requiredApis) {
    if (!storeText.includes(api)) {
      violations.push(`store/index.ts: missing ${api} registration`);
    }
  }
  if (!storeText.includes('base-query') && !existsSync(join(ROOT, 'store/base-query.ts'))) {
    violations.push('store: missing base-query.ts');
  }
}

if (violations.length) {
  console.error('enforce:redux — violations:\n', violations.join('\n'));
  process.exit(1);
}

console.log('enforce:redux — OK');
