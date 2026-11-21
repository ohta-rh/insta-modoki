// Runs every measurement (Lighthouse x 3 screens, INP, feed API p95, initial JS), prints a table and the verdict.
// Last line: `perf: OK`, or `perf: FAIL <indicator> <screen> <value> <|> <limit>` (exit 1). Needs `pnpm build`,
// `seed:bench` and SEED_DEMO_PASSWORD (ADR-0046).
import { fileURLToPath } from 'node:url';
import { gzipTotal, measureInitialJs } from './bundle.mjs';
import { ensureServer, runMain, writeResult } from './common.mjs';
import { measureFeedApi } from './feed-api.mjs';
import { measureInp } from './inp.mjs';
import { demoScreens, measureLighthouse } from './lighthouse.mjs';
import { evaluate, formatViolation, THRESHOLDS } from './thresholds.mjs';

export function table(measurements) {
  const rows = measurements.map(
    (m) => `| ${m.indicator} | ${m.screen} | ${m.value} | ${THRESHOLDS[m.indicator]} |`,
  );
  return ['| 指標 | 画面 | 値 | 基準 |', '|---|---|---|---|', ...rows].join('\n');
}

export async function main() {
  const stop = await ensureServer();
  try {
    const lighthouse = await measureLighthouse(demoScreens);
    const postPath = Object.keys(lighthouse.runs)[2];
    const inp = await measureInp(postPath);
    const feed = await measureFeedApi();
    const files = await measureInitialJs();
    const bytes = gzipTotal(files.map((f) => f.body));
    const measurements = [
      ...lighthouse.measurements,
      ...inp.measurements,
      ...feed.measurements,
      { indicator: 'initialJsGzipBytes', screen: '/', value: bytes },
    ];
    writeResult('run', {
      measurements,
      lighthouseVersion: lighthouse.lighthouseVersion,
      chromiumVersion: lighthouse.chromiumVersion,
      lighthouseRuns: lighthouse.runs,
      inpRuns: inp.runs,
    });
    console.log(table(measurements));
    const violations = evaluate(measurements);
    for (const v of violations) console.log(formatViolation(v));
    if (violations.length > 0) return 1;
    console.log('perf: OK');
    return 0;
  } finally {
    await stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await runMain(main);
