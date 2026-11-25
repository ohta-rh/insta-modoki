import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import config from '../vitest.config.ts';
import { join } from 'node:path';
import {
  COVERAGE_LINES,
  findIntegrationTests,
  INTEGRATION_DIRS,
  main,
  meetsCoverage,
  STEPS,
} from './verify.mjs';

type Deps = Parameters<typeof main>[1];

function harness(overrides: Partial<NonNullable<Deps>> = {}) {
  const lines: string[] = [];
  const executed: string[] = [];
  const deps: NonNullable<Deps> = {
    exec: (command: string) => {
      executed.push(command);
      return 0;
    },
    log: (line: string) => lines.push(line),
    hasIntegrationTests: () => true,
    env: {},
    ...overrides,
  };
  return { lines, executed, deps };
}

describe('verify', () => {
  it('全ての手順が成功すると、verify: OK と出して 0 を返す', () => {
    const { lines, executed, deps } = harness();
    const code = main([], deps);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe('verify: OK');
    expect(executed).toHaveLength(STEPS.length);
  });

  it('手順が失敗すると、その名前を出して後の手順を流さず 0 以外を返す', () => {
    let calls = 0;
    const { lines, deps } = harness({
      exec: () => {
        calls += 1;
        return calls === 6 ? 3 : 0;
      },
    });
    const code = main([], deps);
    expect(code).toBe(3);
    expect(lines).toContain(`verify: FAIL ${STEPS[5].name}`);
    expect(lines.at(-1)).toBe(`verify: FAIL ${STEPS[5].name}`);
    expect(calls).toBe(6);
  });

  it('失敗した手順のコマンドが 0 を返しても、0 以外にならない場合は 1 を返す', () => {
    const { deps } = harness({ exec: () => null });
    expect(main([], deps)).toBe(1);
  });

  it('手順の順番は typecheck → lint → format → docs → unit → integration → build → e2e → perf-budget', () => {
    expect(STEPS.map((s: { name: string }) => s.name)).toEqual([
      'typecheck',
      'lint',
      'format',
      'docs',
      'unit',
      'integration',
      'build',
      'e2e',
      'perf-budget',
    ]);
    const { lines, deps } = harness();
    expect(main(['--list'], deps)).toBe(0);
    expect(lines).toEqual([
      'typecheck',
      'lint',
      'format',
      'docs',
      'unit',
      'integration',
      'build',
      'e2e',
      'perf-budget',
    ]);
  });

  it('docs の手順が format の次にあり、check-docs を流す', () => {
    const names = STEPS.map((s: { name: string }) => s.name);
    expect(names.indexOf('docs')).toBe(names.indexOf('format') + 1);
    expect(names.indexOf('docs')).toBe(names.indexOf('unit') - 1);
    expect(STEPS.find((s: { name: string }) => s.name === 'docs')?.command).toBe(
      'node scripts/check-docs.mjs docs',
    );
  });

  it('verify.md の表が手順の一覧と同じ', () => {
    const md = readFileSync(new URL('../docs/guides/verify.md', import.meta.url), 'utf8');
    const rows = md
      .split('\n')
      .map((l) => l.match(/^\|\s*`([a-z0-9-]+)`\s*\|\s*`([^`]+)`\s*\|/))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => ({ name: m[1], command: m[2] }));
    expect(rows).toEqual(
      STEPS.map((s: { name: string; command: string }) => ({ name: s.name, command: s.command })),
    );
  });

  it('カバレッジの基準（行 80%）を下回ると unit が失敗する', () => {
    expect(COVERAGE_LINES).toBe(80);
    expect(meetsCoverage(79.9)).toBe(false);
    expect(meetsCoverage(80.0)).toBe(true);
    const unit = STEPS.find((s: { name: string }) => s.name === 'unit');
    expect(unit?.command).toContain('--coverage');
  });

  it('vitest の設定のカバレッジの基準と対象が ADR-0024 と同じ', () => {
    const coverage = config.test?.coverage;
    expect(coverage?.thresholds).toMatchObject({ lines: COVERAGE_LINES });
    expect(coverage?.include).toEqual(['src/**/model/**', 'src/shared/config/**']);
  });

  it('結合テストが無いときは integration が 0 で終わる', () => {
    const { lines, executed, deps } = harness({ hasIntegrationTests: () => false });
    expect(main(['--only', 'integration'], deps)).toBe(0);
    expect(lines).toContain('integration: テストなし');
    expect(executed).toEqual([]);
  });

  it('--only で 1 つの手順だけを流す', () => {
    const { lines, executed, deps } = harness();
    expect(main(['--only', 'unit'], deps)).toBe(0);
    expect(executed).toEqual([STEPS.find((s: { name: string }) => s.name === 'unit')?.command]);
    expect(lines.at(-1)).toBe('verify: OK');
  });

  it('--only に存在しない名前を渡すと、不明な手順と出して 2 を返す', () => {
    const { lines, executed, deps } = harness();
    expect(main(['--only', 'foo'], deps)).toBe(2);
    expect(lines).toEqual(['verify: 不明な手順: foo']);
    expect(executed).toEqual([]);
  });

  it('scripts/ の *.int.test.ts も結合テストとして見つける', () => {
    const root = join(import.meta.dirname, '..');
    expect(INTEGRATION_DIRS).toContain('scripts');
    expect(INTEGRATION_DIRS).toContain('tests');
    expect(findIntegrationTests(join(root, 'scripts'))).toBe(true);
  });

  it('SLOT_INT=1 が無いとき、integration でスロットの結合テストを飛ばすと 1 行出す', () => {
    const off = harness({ env: {} });
    main(['--only', 'integration'], off.deps);
    expect(off.lines.filter((l: string) => l.includes('SLOT_INT=1'))).toHaveLength(1);
    const on = harness({ env: { SLOT_INT: '1' } });
    main(['--only', 'integration'], on.deps);
    expect(on.lines.some((l: string) => l.includes('SLOT_INT=1'))).toBe(false);
  });

  it('perf-budget が e2e の後にある', () => {
    const names = STEPS.map((s: { name: string }) => s.name);
    expect(names.indexOf('perf-budget')).toBe(names.indexOf('e2e') + 1);
    expect(STEPS.find((s: { name: string }) => s.name === 'perf-budget')?.command).toBe(
      'node scripts/perf/bundle.mjs',
    );
  });

  it('--with-perf を付けたときだけ perf が足される', () => {
    const plain = harness();
    main(['--list'], plain.deps);
    expect(plain.lines).not.toContain('perf');
    const withPerf = harness();
    expect(main(['--list', '--with-perf'], withPerf.deps)).toBe(0);
    expect(withPerf.lines.at(-1)).toBe('perf');
    expect(withPerf.lines.slice(0, -1)).toEqual(plain.lines);
  });

  it('--only perf は --with-perf が無いと不明な手順で 2、あれば run.mjs だけを流す', () => {
    const off = harness();
    expect(main(['--only', 'perf'], off.deps)).toBe(2);
    expect(off.executed).toEqual([]);
    const on = harness();
    expect(main(['--only', 'perf', '--with-perf'], on.deps)).toBe(0);
    expect(on.executed).toEqual(['node scripts/perf/run.mjs']);
  });
});
