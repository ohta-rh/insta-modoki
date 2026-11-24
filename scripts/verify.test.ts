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

type LockInfo = { pid: number; head: string; worktree: string; startedAt: string };

/** A fake machine: an in-memory lock file, a clock that only `sleep` advances, a fixed HEAD. */
function harness(overrides: Partial<NonNullable<Deps>> = {}) {
  const lines: string[] = [];
  const executed: string[] = [];
  const machine = {
    lockFile: null as LockInfo | null,
    alive: new Set<number>(),
    clock: 0,
    sleeps: [] as number[],
    head: 'aaaaaaa1111111111111111111111111111111111',
    exitHandlers: [] as Array<(signal?: string) => void>,
    onSleep: (() => {}) as (totalMs: number) => void,
  };
  const deps: NonNullable<Deps> = {
    exec: (command: string) => {
      executed.push(command);
      return 0;
    },
    log: (line: string) => lines.push(line),
    hasIntegrationTests: () => true,
    env: {},
    pid: 1000,
    worktree: '/work/self',
    now: () => machine.clock,
    sleep: async (ms: number) => {
      machine.sleeps.push(ms);
      machine.clock += ms;
      machine.onSleep(machine.clock);
    },
    isAlive: (pid: number) => machine.alive.has(pid),
    lock: {
      create: (info: LockInfo) => {
        if (machine.lockFile !== null) return false;
        machine.lockFile = info;
        return true;
      },
      read: () => machine.lockFile,
      remove: () => {
        machine.lockFile = null;
      },
    },
    git: () => ({ head: machine.head, branch: 'pbi/111' }),
    load: () => ({ load1: 2.5, cpus: 10 }),
    onExit: (handler: (signal?: string) => void) => {
      machine.exitHandlers.push(handler);
      return () => {
        machine.exitHandlers = machine.exitHandlers.filter((h) => h !== handler);
      };
    },
    ...overrides,
  };
  return { lines, executed, deps, machine };
}

const other: LockInfo = {
  pid: 2000,
  head: 'bbbbbbb',
  worktree: '/work/other',
  startedAt: '2026-11-24T00:00:00.000Z',
};

describe('verify', () => {
  it('全ての手順が成功すると、verify: OK と出して 0 を返す', async () => {
    const { lines, executed, deps } = harness();
    const code = await main([], deps);
    expect(code).toBe(0);
    expect(lines.at(-1)).toBe('verify: OK aaaaaaa');
    expect(executed).toHaveLength(STEPS.length);
  });

  it('手順が失敗すると、その名前を出して後の手順を流さず 0 以外を返す', async () => {
    let calls = 0;
    const { lines, deps } = harness({
      exec: () => {
        calls += 1;
        return calls === 6 ? 3 : 0;
      },
    });
    const code = await main([], deps);
    expect(code).toBe(3);
    expect(lines).toContain(`verify: FAIL ${STEPS[5].name}`);
    expect(lines.at(-1)).toBe(`verify: FAIL ${STEPS[5].name}`);
    expect(calls).toBe(6);
  });

  it('失敗した手順のコマンドが 0 を返しても、0 以外にならない場合は 1 を返す', async () => {
    const { deps } = harness({ exec: () => null });
    expect(await main([], deps)).toBe(1);
  });

  it('手順の順番は typecheck → lint → format → docs → unit → integration → integration-seed → int-budget → build → e2e → perf-budget', async () => {
    expect(STEPS.map((s: { name: string }) => s.name)).toEqual([
      'typecheck',
      'lint',
      'format',
      'docs',
      'unit',
      'integration',
      'integration-seed',
      'int-budget',
      'build',
      'e2e',
      'perf-budget',
    ]);
    const { lines, deps } = harness();
    expect(await main(['--list'], deps)).toBe(0);
    expect(lines).toEqual([
      'typecheck',
      'lint',
      'format',
      'docs',
      'unit',
      'integration',
      'integration-seed',
      'int-budget',
      'build',
      'e2e',
      'perf-budget',
    ]);
  });

  it('docs の手順が format の次にあり、check-docs を流す', async () => {
    const names = STEPS.map((s: { name: string }) => s.name);
    expect(names.indexOf('docs')).toBe(names.indexOf('format') + 1);
    expect(names.indexOf('docs')).toBe(names.indexOf('unit') - 1);
    expect(STEPS.find((s: { name: string }) => s.name === 'docs')?.command).toBe(
      'node scripts/check-docs.mjs docs',
    );
  });

  it('verify.md の表が手順の一覧と同じ', async () => {
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

  it('カバレッジの基準（行 80%）を下回ると unit が失敗する', async () => {
    expect(COVERAGE_LINES).toBe(80);
    expect(meetsCoverage(79.9)).toBe(false);
    expect(meetsCoverage(80.0)).toBe(true);
    const unit = STEPS.find((s: { name: string }) => s.name === 'unit');
    expect(unit?.command).toContain('--coverage');
  });

  it('vitest の設定のカバレッジの基準と対象が ADR-0024 と同じ', async () => {
    const coverage = config.test?.coverage;
    expect(coverage?.thresholds).toMatchObject({ lines: COVERAGE_LINES });
    expect(coverage?.include).toEqual(['src/**/model/**', 'src/shared/config/**']);
  });

  it('結合テストが無いときは integration が 0 で終わる', async () => {
    const { lines, executed, deps } = harness({ hasIntegrationTests: () => false });
    expect(await main(['--only', 'integration'], deps)).toBe(0);
    expect(lines).toContain('integration: テストなし');
    expect(executed).toEqual([]);
  });

  it('--only で 1 つの手順だけを流す', async () => {
    const { lines, executed, deps } = harness();
    expect(await main(['--only', 'unit'], deps)).toBe(0);
    expect(executed).toEqual([STEPS.find((s: { name: string }) => s.name === 'unit')?.command]);
    expect(lines.at(-1)).toBe('verify: OK aaaaaaa');
  });

  it('--only に存在しない名前を渡すと、不明な手順と出して 2 を返す', async () => {
    const { lines, executed, deps } = harness();
    expect(await main(['--only', 'foo'], deps)).toBe(2);
    expect(lines).toEqual(['verify: 不明な手順: foo']);
    expect(executed).toEqual([]);
  });

  it('scripts/ の *.int.test.ts も結合テストとして見つける', async () => {
    const root = join(import.meta.dirname, '..');
    expect(INTEGRATION_DIRS).toContain('scripts');
    expect(INTEGRATION_DIRS).toContain('tests');
    expect(findIntegrationTests(join(root, 'scripts'))).toBe(true);
  });

  it('SLOT_INT=1 が無いとき、integration でスロットの結合テストを飛ばすと 1 行出す', async () => {
    const off = harness({ env: {} });
    await main(['--only', 'integration'], off.deps);
    expect(off.lines.filter((l: string) => l.includes('SLOT_INT=1'))).toHaveLength(1);
    const on = harness({ env: { SLOT_INT: '1' } });
    await main(['--only', 'integration'], on.deps);
    expect(on.lines.some((l: string) => l.includes('SLOT_INT=1'))).toBe(false);
  });

  it('perf-budget が e2e の後にある', async () => {
    const names = STEPS.map((s: { name: string }) => s.name);
    expect(names.indexOf('perf-budget')).toBe(names.indexOf('e2e') + 1);
    expect(STEPS.find((s: { name: string }) => s.name === 'perf-budget')?.command).toBe(
      'node scripts/perf/bundle.mjs',
    );
  });

  it('--with-perf を付けたときだけ perf が足される', async () => {
    const plain = harness();
    await main(['--list'], plain.deps);
    expect(plain.lines).not.toContain('perf');
    const withPerf = harness();
    expect(await main(['--list', '--with-perf'], withPerf.deps)).toBe(0);
    expect(withPerf.lines.at(-1)).toBe('perf');
    expect(withPerf.lines.slice(0, -1)).toEqual(plain.lines);
  });

  it('--only perf は --with-perf が無いと不明な手順で 2、あれば run.mjs だけを流す', async () => {
    const off = harness();
    expect(await main(['--only', 'perf'], off.deps)).toBe(2);
    expect(off.executed).toEqual([]);
    const on = harness();
    expect(await main(['--only', 'perf', '--with-perf'], on.deps)).toBe(0);
    expect(on.executed).toEqual(['node scripts/perf/run.mjs']);
  });

  it('another live verify holds the lock: waits, then runs after it is released', async () => {
    const { lines, executed, deps, machine } = harness();
    machine.lockFile = other;
    machine.alive.add(2000);
    let executedWhileLocked = false;
    machine.onSleep = (total) => {
      if (executed.length > 0 && machine.lockFile?.pid === 2000) executedWhileLocked = true;
      if (total >= 30_000) machine.lockFile = null;
    };
    expect(await main(['--only', 'unit'], deps)).toBe(0);
    expect(lines).toContain('verify: 別の verify（pid 2000、/work/other）が終わるまで待ちます');
    expect(machine.sleeps.every((ms) => ms === 10_000)).toBe(true);
    expect(executedWhileLocked).toBe(false);
    expect(executed).toHaveLength(1);
    expect(lines.indexOf('verify: unit ...')).toBeGreaterThan(
      lines.indexOf('verify: 別の verify（pid 2000、/work/other）が終わるまで待ちます'),
    );
  });

  it('a lock left by a dead process is taken over', async () => {
    const { lines, executed, deps, machine } = harness();
    machine.lockFile = { ...other, pid: 2001 };
    expect(await main(['--only', 'unit'], deps)).toBe(0);
    expect(lines).toContain('verify: 終わっていない verify（pid 2001）のロックを引き継ぎます');
    expect(machine.sleeps).toEqual([]);
    expect(executed).toHaveLength(1);
  });

  it('gives up after 60 minutes of waiting with exit 1', async () => {
    const { lines, executed, deps, machine } = harness();
    machine.lockFile = other;
    machine.alive.add(2000);
    expect(await main([], deps)).toBe(1);
    expect(lines.at(-1)).toBe('verify: 60 分待っても別の verify が終わりません');
    expect(executed).toEqual([]);
    expect(machine.clock).toBe(60 * 60_000 + 10_000);
    expect(lines.filter((l: string) => l.includes('待っています'))).toHaveLength(60);
  });

  it('waits up to exactly 60 minutes and runs if the lock is released then', async () => {
    const { executed, deps, machine } = harness();
    machine.lockFile = other;
    machine.alive.add(2000);
    machine.onSleep = (total) => {
      if (total === 60 * 60_000) machine.lockFile = null;
    };
    expect(await main(['--only', 'unit'], deps)).toBe(0);
    expect(executed).toHaveLength(1);
  });

  it('the lock is released on success, failure and signals', async () => {
    const ok = harness();
    expect(await main(['--only', 'unit'], ok.deps)).toBe(0);
    expect(ok.machine.lockFile).toBeNull();
    expect(ok.machine.exitHandlers).toEqual([]);

    const failing = harness({ exec: () => 7 });
    expect(await main(['--only', 'unit'], failing.deps)).toBe(7);
    expect(failing.machine.lockFile).toBeNull();

    for (const signal of ['SIGINT', 'SIGTERM', undefined]) {
      const h = harness({
        exec: () => {
          expect(h.machine.lockFile?.pid).toBe(1000);
          h.machine.exitHandlers.forEach((handler) => handler(signal));
          return 0;
        },
      });
      await main(['--only', 'unit'], h.deps);
      expect(h.machine.lockFile).toBeNull();
    }
  });

  it('a signal handler does not remove a lock that another pid now holds', async () => {
    const h = harness({
      exec: () => {
        h.machine.lockFile = other;
        h.machine.exitHandlers.forEach((handler) => handler('SIGTERM'));
        return 0;
      },
    });
    await main(['--only', 'unit'], h.deps);
    expect(h.machine.lockFile).toEqual(other);
  });

  it('prints the HEAD and the load average before the first step', async () => {
    const { lines, deps } = harness();
    await main(['--only', 'unit'], deps);
    expect(lines.slice(0, 3)).toEqual([
      'verify: HEAD aaaaaaa pbi/111',
      'verify: load average 2.5 / CPU 10',
      'verify: unit ...',
    ]);
  });

  it('fails when HEAD moved during the run', async () => {
    const h = harness({
      exec: () => {
        h.machine.head = 'ccccccc2222222222222222222222222222222222';
        return 0;
      },
    });
    expect(await main(['--only', 'unit'], h.deps)).toBe(1);
    expect(h.lines.at(-1)).toBe('verify: FAIL HEAD が実行中に aaaaaaa から ccccccc に変わりました');
    expect(h.lines.some((l: string) => l.startsWith('verify: OK'))).toBe(false);
    expect(h.machine.lockFile).toBeNull();
  });

  it('the OK line names the verified commit', async () => {
    const { lines, deps } = harness();
    expect(await main([], deps)).toBe(0);
    expect(lines.at(-1)).toBe('verify: OK aaaaaaa');
  });

  it('--list takes no lock', async () => {
    const { lines, deps, machine } = harness({
      lock: {
        create: () => {
          throw new Error('lock taken');
        },
        read: () => {
          throw new Error('lock read');
        },
        remove: () => {
          throw new Error('lock removed');
        },
      },
    });
    machine.lockFile = other;
    expect(await main(['--list'], deps)).toBe(0);
    expect(lines).toEqual(STEPS.map((s: { name: string }) => s.name));
    expect(machine.exitHandlers).toEqual([]);
  });

  it('the lock records pid, HEAD, worktree and start time', async () => {
    const { deps, machine } = harness();
    let seen: LockInfo | null = null;
    const exec = () => {
      seen = machine.lockFile;
      return 0;
    };
    await main(['--only', 'unit'], { ...deps, exec });
    expect(seen).toMatchObject({
      pid: 1000,
      head: 'aaaaaaa',
      worktree: '/work/self',
      startedAt: '1970-01-01T00:00:00.000Z',
    });
  });

  it('bad arguments take no lock', async () => {
    const { deps, machine } = harness();
    machine.lockFile = other;
    machine.alive.add(2000);
    expect(await main(['--only', 'foo'], deps)).toBe(2);
    expect(await main(['--bogus'], deps)).toBe(2);
    expect(machine.sleeps).toEqual([]);
  });
});
