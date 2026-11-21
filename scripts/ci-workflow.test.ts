import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

// The workflow is read by line patterns, not parsed (no YAML dependency; ADR-0027).
const ci = readFileSync(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8');
const lines = ci.split('\n');
const has = (re: RegExp) => lines.some((l) => re.test(l));

describe('.github/workflows/ci.yml', () => {
  it('push と pull_request で動く', () => {
    expect(has(/^on:\s*$/)).toBe(true);
    expect(ci).toMatch(/^ {2}push:\s*\n {4}branches: \[main\]\s*$/m);
    expect(has(/^ {2}pull_request:/)).toBe(true);
  });

  it('permissions が contents: read だけ', () => {
    expect(ci).toMatch(/^permissions:\s*\n {2}contents: read\s*(\n[^ \n]|\n*$)/m);
    expect(lines.filter((l) => /^\s*(permissions|[a-z-]+: (read|write))\b/.test(l))).toEqual([
      'permissions:',
      '  contents: read',
    ]);
  });

  it('timeout-minutes が 20 で、同じ ref の古い実行を取り消す', () => {
    expect(has(/^ {4}timeout-minutes: 20\s*$/)).toBe(true);
    expect(ci).toMatch(
      /^concurrency:\s*\n {2}group: .*github\.ref.*\n {2}cancel-in-progress: true/m,
    );
  });

  it('Node は .node-version、pnpm は packageManager から入れ、frozen-lockfile で install する', () => {
    expect(has(/node-version-file: \.node-version/)).toBe(true);
    expect(has(/cache: pnpm/)).toBe(true);
    expect(has(/run: pnpm install --frozen-lockfile/)).toBe(true);
  });

  it('verify を node scripts/verify.mjs で流す', () => {
    const order = [
      /run: docker compose up -d --wait\s*$/,
      /run: node scripts\/slot\.mjs prepare 0\s*$/,
      /run: pnpm exec playwright install --with-deps chromium\s*$/,
      /run: node scripts\/verify\.mjs\s*$/,
    ].map((re) => lines.findIndex((l) => re.test(l)));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(ci).toMatch(/PORT: 3100/);
    expect(ci).toMatch(/SLOT_INT: 1/);
  });

  it('失敗したとき playwright-report を upload する', () => {
    const i = lines.findIndex((l) => /uses: actions\/upload-artifact@/.test(l));
    expect(i).toBeGreaterThan(0);
    const step = lines.slice(Math.max(0, i - 3), i + 6).join('\n');
    expect(step).toMatch(/if: failure\(\)/);
    expect(step).toMatch(/path: playwright-report/);
  });

  it('全ての uses が 40 桁の commit SHA で固定されている', () => {
    const uses = lines.filter((l) => /^\s*(- )?uses:/.test(l));
    expect(uses.length).toBeGreaterThanOrEqual(4);
    for (const l of uses) expect(l).toMatch(/uses: [\w./-]+@[0-9a-f]{40}(\s+#.*)?\s*$/);
  });
});
