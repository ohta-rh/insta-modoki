import { describe, expect, it } from 'vitest';
import { BUDGET_RATIO, main } from './int-budget.mjs';

type Deps = NonNullable<Parameters<typeof main>[1]>;
type Result = { file: string; name: string; durationMs: number; timeoutMs: number };

const A = 'src/a.int.test.ts';
const B = 'src/b.int.test.ts';
const r = (file: string, name: string, durationMs: number, timeoutMs = 5000): Result => ({
  file,
  name,
  durationMs,
  timeoutMs,
});

/** `runs` are the results of each successive vitest run; every call records the files it got. */
function harness(runs: { status?: number; results: Result[] }[], overrides: Partial<Deps> = {}) {
  const lines: string[] = [];
  const calls: string[][] = [];
  let i = 0;
  const deps: Deps = {
    log: (line: string) => lines.push(line),
    listFiles: () => [A, B],
    changedFiles: () => [A, B],
    runVitest: (files: string[]) => {
      calls.push(files);
      const run = runs[Math.min(i, runs.length - 1)]!;
      i += 1;
      return { status: run.status ?? 0, results: run.results };
    },
    ...overrides,
  };
  return { lines, calls, deps };
}

describe('int-budget', () => {
  it('予算の割合は 25%', () => {
    expect(BUDGET_RATIO).toBe(0.25);
  });

  it('3 回の最小が上限の 25% を超えたテストだけを FAIL にする', () => {
    const { lines, calls, deps } = harness([
      { results: [r(A, 'slow', 2000), r(A, 'fast', 100), r(B, 'other', 300)] },
      { results: [r(A, 'slow', 1500), r(A, 'fast', 90)] },
      { results: [r(A, 'slow', 1400), r(A, 'fast', 95)] },
    ]);
    expect(main([], deps)).toBe(1);
    expect(lines).toContain(`int-budget: FAIL ${A} › slow 1400ms > 1250ms（上限 5000ms）`);
    expect(lines.filter((l) => l.startsWith('int-budget: FAIL'))).toHaveLength(1);
    expect(lines.at(-1)).toContain('1 件が予算（上限の 25%）を超えました');
    // The two reruns run only the file that went over.
    expect(calls).toEqual([[A, B], [A], [A]]);
  });

  it('25% ちょうどは通る', () => {
    const { lines, calls, deps } = harness([{ results: [r(A, 'edge', 1250)] }]);
    expect(main([], deps)).toBe(0);
    expect(lines.some((l) => l.includes('FAIL'))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it('1 回目だけ遅いテストは通る', () => {
    const { lines, deps } = harness([
      { results: [r(A, 'once', 4000)] },
      { results: [r(A, 'once', 200)] },
      { results: [r(A, 'once', 300)] },
    ]);
    expect(main([], deps)).toBe(0);
    expect(lines.some((l) => l.includes('FAIL'))).toBe(false);
  });

  it('個別の上限を持つテストはその上限の 25% で測る', () => {
    const { deps } = harness([
      { results: [r(A, 'long', 14_000, 60_000)] },
      { results: [r(A, 'long', 14_000, 60_000)] },
      { results: [r(A, 'long', 14_000, 60_000)] },
    ]);
    expect(main([], deps)).toBe(0);
    const over = harness([{ results: [r(A, 'long', 15_001, 60_000)] }]);
    expect(main([], over.deps)).toBe(1);
    expect(over.lines).toContain(`int-budget: FAIL ${A} › long 15001ms > 15000ms（上限 60000ms）`);
  });

  it('変わったファイルだけを測る', () => {
    const { calls, deps } = harness([{ results: [] }], { changedFiles: () => [B] });
    expect(main([], deps)).toBe(0);
    expect(calls).toEqual([[B]]);
  });

  it('変わった結合テストが無ければ、そう出して 0 で終わり vitest は流さない', () => {
    const { lines, calls, deps } = harness([{ results: [] }], { changedFiles: () => [] });
    expect(main([], deps)).toBe(0);
    expect(lines).toContain('int-budget: 変わった結合テストなし');
    expect(calls).toEqual([]);
  });

  it('基準が無いときは全てを測る', () => {
    const { lines, calls, deps } = harness([{ results: [] }], { changedFiles: () => null });
    expect(main([], deps)).toBe(0);
    expect(lines).toContain('int-budget: 基準のコミットが無いので全ての結合テストを測ります');
    expect(calls).toEqual([[A, B]]);
  });

  it('--all は変更に関わらず全てを測る', () => {
    const { calls, deps } = harness([{ results: [] }], { changedFiles: () => [B] });
    expect(main(['--all'], deps)).toBe(0);
    expect(calls).toEqual([[A, B]]);
  });

  it('seed と slot の結合テストは測らない', () => {
    const seed = 'src/shared/db/seed/seed.int.test.ts';
    const slot = 'scripts/slot.int.test.ts';
    const changed = harness([{ results: [] }], { changedFiles: () => [A, seed, slot] });
    expect(main([], changed.deps)).toBe(0);
    expect(changed.calls).toEqual([[A]]);
    const all = harness([{ results: [] }], { listFiles: () => [A, seed, slot] });
    expect(main(['--all'], all.deps)).toBe(0);
    expect(all.calls).toEqual([[A]]);
    const onlyExcluded = harness([{ results: [] }], { changedFiles: () => [seed] });
    expect(main([], onlyExcluded.deps)).toBe(0);
    expect(onlyExcluded.lines).toContain('int-budget: 変わった結合テストなし');
    expect(onlyExcluded.calls).toEqual([]);
  });

  it('vitest が 0 以外で終わったら、そのコードで終わる', () => {
    const { deps } = harness([{ status: 3, results: [r(A, 'x', 10)] }]);
    expect(main([], deps)).toBe(3);
  });

  it('不明な引数は 2', () => {
    const { lines, deps } = harness([{ results: [] }]);
    expect(main(['--foo'], deps)).toBe(2);
    expect(lines).toEqual(['int-budget: 不明な引数: --foo']);
  });
});
