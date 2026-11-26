// Draws public/brand/logo-mark.svg into the three PWA icons with the installed Playwright Chromium:
//   node scripts/pwa-icons.mjs
// No other dependency; the PNGs are committed (public/icons/). Our own artwork only (ADR-0003).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const root = new URL('../', import.meta.url);
const outDir = new URL('public/icons/', root);
const mark = readFileSync(new URL('public/brand/logo-mark.svg', root), 'utf8');

const ICONS = [
  { file: 'icon-192.png', size: 192, padding: 0.1 },
  { file: 'icon-512.png', size: 512, padding: 0.1 },
  // maskable: the mark sits inside the safe zone, 20% empty on every side
  { file: 'icon-maskable-512.png', size: 512, padding: 0.2 },
];

mkdirSync(fileURLToPath(outDir), { recursive: true });
const browser = await chromium.launch();
try {
  for (const { file, size, padding } of ICONS) {
    const page = await browser.newPage({ viewport: { width: size, height: size } });
    const inner = Math.round(size * (1 - padding * 2));
    const svg = mark.replace(/width="48" height="48"/, `width="${inner}" height="${inner}"`);
    await page.setContent(
      `<body style="margin:0;background:#fff;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">${svg}</body>`,
    );
    writeFileSync(new URL(file, outDir), await page.screenshot({ type: 'png' }));
    await page.close();
  }
} finally {
  await browser.close();
}
