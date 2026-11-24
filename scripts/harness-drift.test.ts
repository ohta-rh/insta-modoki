import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from './harness-drift.mjs';

type Deps = NonNullable<Parameters<typeof main>[1]>;
type GitResult = { status: number; stdout: string; stderr: string };

const ROOT = join(import.meta.dirname, '..');

/** A fake git: `diff` is what `git diff --name-only` prints; `branchExists` answers rev-parse. */
function harness(opts: { diff?: GitResult; branchExists?: boolean } = {}) {
  const lines: string[] = [];
  const calls: string[][] = [];
  const deps: Deps = {
    git: (args) => {
      calls.push(args);
      if (args[0] === 'rev-parse') {
        return opts.branchExists === false
          ? { status: 1, stdout: '', stderr: '' }
          : { status: 0, stdout: 'abc\n', stderr: '' };
      }
      return opts.diff ?? { status: 0, stdout: '', stderr: '' };
    },
    log: (line) => lines.push(line),
  };
  return { lines, calls, deps };
}

const files = (n: number) =>
  Array.from({ length: n }, (_, i) => `.claude/rules/r${i}.md`).join('\n') + '\n';

describe('harness-drift', () => {
  it('差があるとファイルを挙げて 1 で終わる', async () => {
    const { lines, calls, deps } = harness({
      diff: { status: 0, stdout: '.claude/agents/code-reviewer.md\nCLAUDE.md\n', stderr: '' },
    });
    expect(await main(['m2/x'], deps)).toBe(1);
    expect(lines).toEqual([
      'harness-drift: main checkout のハーネスが origin/m2/x と違います。main checkout で git switch m2/x してください',
      '  .claude/agents/code-reviewer.md',
      '  CLAUDE.md',
    ]);
    expect(calls).toContainEqual([
      'diff',
      '--name-only',
      'HEAD',
      'origin/m2/x',
      '--',
      'CLAUDE.md',
      '.claude',
    ]);
  });

  it('差が無いと 0 で終わる', async () => {
    const { lines, deps } = harness();
    expect(await main(['m2/x'], deps)).toBe(0);
    expect(lines).toEqual(['harness-drift: main checkout のハーネスは origin/m2/x と同じです']);
  });

  it('枝が読めないと 2 で終わる', async () => {
    const missing = harness({ branchExists: false });
    expect(await main(['m2/x'], missing.deps)).toBe(2);
    expect(missing.lines).toHaveLength(1);
    expect(missing.lines[0]).toContain('origin/m2/x');

    const failing = harness({ diff: { status: 128, stdout: '', stderr: 'fatal: boom\n' } });
    expect(await main(['m2/x'], failing.deps)).toBe(2);
    expect(failing.lines).toHaveLength(1);
    expect(failing.lines[0]).toContain('fatal: boom');
  });

  it('ブランチ名が無いと 2 で終わる', async () => {
    const { lines, deps } = harness();
    expect(await main([], deps)).toBe(2);
    expect(lines).toEqual([
      'harness-drift: ブランチ名を 1 つ渡してください（例: node scripts/harness-drift.mjs main）',
    ]);
  });

  it('違うファイルは 20 行まで出し、残りは件数にする', async () => {
    const { lines, deps } = harness({ diff: { status: 0, stdout: files(23), stderr: '' } });
    expect(await main(['m2/x'], deps)).toBe(1);
    expect(lines).toHaveLength(1 + 20 + 1);
    expect(lines.at(-1)).toBe('  ほか 3 件');
    const exact = harness({ diff: { status: 0, stdout: files(20), stderr: '' } });
    await main(['m2/x'], exact.deps);
    expect(exact.lines).toHaveLength(1 + 20);
  });

  it('delivery.md §4 は統合ブランチへの切り替えと harness-drift の確認を書いている', () => {
    const flat = readFileSync(join(ROOT, '.claude/rules/delivery.md'), 'utf8').replace(/\s+/g, ' ');
    expect(flat).toContain('switch the main checkout to that branch');
    expect(flat).toContain('Integrate in the main checkout; do not create a worktree for the integration branch');
    expect(flat).toContain('`node scripts/harness-drift.mjs <integration branch>` exits 0');
  });
});
