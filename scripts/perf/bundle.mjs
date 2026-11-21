// Initial JS budget: gzip (level 9) of every same-origin JavaScript response loaded by the first
// open of `/` as a signed-in user. Prints `bundle: initial js gzip=<n> limit=<limit>`; exit 1 over the limit.
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { baseUrl, ensureServer, runMain, signUpFresh, writeResult } from './common.mjs';
import { evaluate, formatViolation, THRESHOLDS } from './thresholds.mjs';

export const gzipTotal = (buffers) =>
  buffers.reduce((sum, b) => sum + gzipSync(b, { level: 9 }).length, 0);

export function bundleReport(bytes) {
  const lines = [`bundle: initial js gzip=${bytes} limit=${THRESHOLDS.initialJsGzipBytes}`];
  const violations = evaluate([{ indicator: 'initialJsGzipBytes', screen: '/', value: bytes }]);
  for (const v of violations) lines.push(formatViolation(v));
  return { lines, code: violations.length === 0 ? 0 : 1 };
}

/** Opens `/` signed in and returns the same-origin JS responses' bodies. */
export async function measureInitialJs() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signUpFresh(page);
    // A new page in the signed-in context, so `/` is the first open of that page.
    const fresh = await context.newPage();
    const origin = new URL(baseUrl()).origin;
    const pending = [];
    fresh.on('response', (response) => {
      const url = new URL(response.url());
      const type = response.headers()['content-type'] ?? '';
      if (url.origin === origin && (/javascript/.test(type) || url.pathname.endsWith('.js'))) {
        pending.push(response.body().then((body) => ({ url: url.pathname, body })));
      }
    });
    await fresh.goto(`${baseUrl()}/`, { waitUntil: 'networkidle' });
    return await Promise.all(pending);
  } finally {
    await browser.close();
  }
}

export async function main() {
  const stop = await ensureServer();
  try {
    const files = await measureInitialJs();
    const bytes = gzipTotal(files.map((f) => f.body));
    const { lines, code } = bundleReport(bytes);
    for (const l of lines) console.log(l);
    writeResult('bundle', {
      initialJsGzipBytes: bytes,
      files: files.map((f) => ({ url: f.url, gzip: gzipTotal([f.body]) })),
    });
    return code;
  } finally {
    await stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runMain(main);
