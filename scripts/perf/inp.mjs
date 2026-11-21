// INP with web-vitals: like on the feed, scroll it, then open and type in the comment box of a post.
// The page runs with the CPU 4x slower (the Lighthouse mobile setting) in a 375px viewport (ADR-0046).
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { baseUrl, ensureServer, loginAsDemo, runMain, writeResult } from './common.mjs';
import { median } from './stats.mjs';

export const RUNS = 3;

// The package's exports hide the IIFE build, so it is read next to the CommonJS entry that does resolve.
const webVitalsSource = () =>
  readFileSync(
    join(dirname(createRequire(import.meta.url).resolve('web-vitals')), 'web-vitals.iife.js'),
    'utf8',
  );

const readInp = (page) => page.evaluate(() => window.__inp ?? null);

async function hydrated(page) {
  await page.locator('html[data-hydrated="1"]').waitFor({ state: 'attached' });
}

/** One pass of the scenario; returns the worst INP (ms) seen on the two pages. */
export async function scenario(context, postPath) {
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.addInitScript(
    `${webVitalsSource()}\nwebVitals.onINP((m) => { window.__inp = m.value; }, { reportAllChanges: true });`,
  );
  // Feed: press the like button, then scroll.
  await page.goto(`${baseUrl()}/`);
  await hydrated(page);
  const like = page.getByRole('button', { name: 'いいね' }).first();
  await like.click();
  await page.waitForTimeout(500);
  for (let i = 0; i < 6; i += 1) {
    await page.mouse.wheel(0, 600);
    await page.waitForTimeout(150);
  }
  const feedInp = await readInp(page);
  // Post: open the comment box and type.
  await page.goto(`${baseUrl()}${postPath}`);
  await hydrated(page);
  const box = page.locator('#comment-input');
  await box.click();
  await box.pressSequentially('hello', { delay: 30 });
  await page.waitForTimeout(500);
  const postInp = await readInp(page);
  await page.close();
  const seen = [feedInp, postInp].filter((v) => v !== null);
  if (seen.length === 0) throw new Error('perf: INP が 1 つも測れませんでした');
  return { feedInp, postInp, inp: Math.max(...seen) };
}

export async function measureInp(postPath) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
    const page = await context.newPage();
    await loginAsDemo(page);
    await page.close();
    const runs = [];
    for (let i = 0; i < RUNS; i += 1) runs.push(await scenario(context, postPath));
    return {
      measurements: [{ indicator: 'inpMs', screen: '/', value: median(runs.map((r) => r.inp)) }],
      runs,
    };
  } finally {
    await browser.close();
  }
}

export async function main() {
  const stop = await ensureServer();
  try {
    const { demoScreens } = await import('./lighthouse.mjs');
    const browser = await chromium.launch();
    let postPath;
    try {
      const page = await browser.newPage();
      await loginAsDemo(page);
      postPath = (await demoScreens(page))[2];
    } finally {
      await browser.close();
    }
    const result = await measureInp(postPath);
    writeResult('inp', result);
    console.log(`inp: ${result.measurements[0].value}ms`);
    return 0;
  } finally {
    await stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runMain(main);
