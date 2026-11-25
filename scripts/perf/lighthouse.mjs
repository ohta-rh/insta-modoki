// Lighthouse (mobile preset: simulated slow 4G, 4x CPU) on three screens, 3 runs each, median per metric.
// Playwright's bundled Chromium is started with --remote-debugging-port and Lighthouse connects to it (ADR-0046).
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { baseUrl, ensureServer, loginAsDemo, runMain, writeResult } from './common.mjs';
import { median } from './stats.mjs';

export const RUNS = 3;

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

/** Median of each metric over the runs: [{ screen, score, lcpMs, cls }] -> measurement rows. */
export function toMeasurements(screen, runs) {
  return [
    { indicator: 'lighthouseScore', screen, value: median(runs.map((r) => r.score)) },
    { indicator: 'lcpMs', screen, value: median(runs.map((r) => r.lcpMs)) },
    { indicator: 'cls', screen, value: median(runs.map((r) => r.cls)) },
  ];
}

/**
 * Measures `screens` (paths) as the demo user.
 * @returns {Promise<{ measurements: object[], runs: Record<string, object[]>, lighthouseVersion: string, chromiumVersion: string }>}
 */
export async function measureLighthouse(resolveScreens) {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), 'perf-lh-'));
  const context = await chromium.launchPersistentContext(profile, {
    headless: true,
    args: [`--remote-debugging-port=${port}`],
  });
  try {
    const page = context.pages()[0] ?? (await context.newPage());
    await loginAsDemo(page);
    const screens = await resolveScreens(page);
    await page.goto('about:blank');
    const measurements = [];
    const runs = {};
    let lighthouseVersion = '';
    for (const screen of screens) {
      runs[screen] = [];
      for (let i = 0; i < RUNS; i += 1) {
        const result = await lighthouse(`${baseUrl()}${screen}`, {
          port,
          output: 'json',
          logLevel: 'error',
          onlyCategories: ['performance'],
          disableStorageReset: true,
        });
        const lhr = result.lhr;
        if (lhr.runtimeError) throw new Error(`${screen}: ${lhr.runtimeError.message}`);
        if (new URL(lhr.finalDisplayedUrl).pathname !== screen)
          throw new Error(
            `${screen}: ${lhr.finalDisplayedUrl} に移りました（ログインが切れた可能性）`,
          );
        lighthouseVersion = lhr.lighthouseVersion;
        runs[screen].push({
          score: Math.round(lhr.categories.performance.score * 100),
          lcpMs: Math.round(lhr.audits['largest-contentful-paint'].numericValue),
          cls: Number(lhr.audits['cumulative-layout-shift'].numericValue.toFixed(4)),
        });
      }
      measurements.push(...toMeasurements(screen, runs[screen]));
    }
    return {
      measurements,
      runs,
      lighthouseVersion,
      chromiumVersion: context.browser()?.version() ?? '',
    };
  } finally {
    await context.close();
    rmSync(profile, { recursive: true, force: true });
  }
}

/** `/`, `/demo` and the demo user's first post, read from the profile grid. */
export async function demoScreens(page) {
  await page.goto(`${baseUrl()}/demo`);
  const href = await page.locator('a[href^="/p/"]').first().getAttribute('href');
  if (!href)
    throw new Error('perf: demo の最初の投稿が見つかりません（seed:bench は済んでいますか）');
  return ['/', '/demo', href];
}

export async function main() {
  const stop = await ensureServer();
  try {
    const result = await measureLighthouse(demoScreens);
    writeResult('lighthouse', result);
    for (const m of result.measurements)
      console.log(`lighthouse: ${m.screen} ${m.indicator}=${m.value}`);
    return 0;
  } finally {
    await stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runMain(main);
