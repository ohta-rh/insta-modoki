import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { main } from './ci-gate.mjs';

type Deps = NonNullable<Parameters<typeof main>[1]>;
type Run = { headSha: string; status: string; conclusion: string; url: string };

const ROOT = join(import.meta.dirname, '..');
const HEAD = 'abc1234567890abc1234567890abc1234567890a';
const URL = 'https://github.com/o/r/actions/runs/1';

const run = (overrides: Partial<Run> = {}): Run => ({
  headSha: HEAD,
  status: 'completed',
  conclusion: 'success',
  url: URL,
  ...overrides,
});

/** A fake gh and git: `runs` is what `gh run list` prints, `head` what `git rev-parse` gives. */
function harness(opts: { runs?: Run[]; head?: string | null; gh?: Deps['gh'] } = {}) {
  const lines: string[] = [];
  const calls: string[][] = [];
  const deps: Deps = {
    gh: (args) => {
      calls.push(args);
      return opts.gh
        ? opts.gh(args)
        : { status: 0, stdout: JSON.stringify(opts.runs ?? [run()]), stderr: '' };
    },
    revParse: () => (opts.head === undefined ? HEAD : opts.head),
    log: (line) => lines.push(line),
  };
  return { lines, calls, deps };
}

describe('ci-gate', () => {
  it('a failed or cancelled latest run exits 1 with the run URL', async () => {
    for (const conclusion of ['failure', 'cancelled']) {
      const { lines, deps } = harness({ runs: [run({ conclusion })] });
      expect(await main(['m2/x'], deps)).toBe(1);
      expect(lines).toEqual([
        `ci-gate: m2/x の最新の CI（${HEAD}）は ${conclusion} です。ほかの作業より先に直してください: ${URL}`,
      ]);
    }
  });

  it('a successful latest run exits 0', async () => {
    const { lines, calls, deps } = harness();
    expect(await main(['m2/x'], deps)).toBe(0);
    expect(lines).toEqual([`ci-gate: m2/x は緑です（${HEAD}）`]);
    expect(calls[0]).toEqual([
      'run',
      'list',
      '--branch',
      'm2/x',
      '--workflow',
      'CI',
      '--limit',
      '1',
      '--json',
      'headSha,status,conclusion,url',
    ]);
  });

  it('a running latest run exits 3', async () => {
    for (const status of ['in_progress', 'queued']) {
      const { lines, deps } = harness({ runs: [run({ status, conclusion: '' })] });
      expect(await main(['m2/x'], deps)).toBe(3);
      expect(lines).toEqual([`ci-gate: ${HEAD} の CI は実行中です`]);
    }
  });

  it('no run for the branch head exits 3', async () => {
    const other = 'f'.repeat(40);
    for (const runs of [[run({ headSha: other, conclusion: 'failure' })], []]) {
      const { lines, deps } = harness({ runs });
      expect(await main(['m2/x'], deps)).toBe(3);
      expect(lines).toEqual([`ci-gate: 先頭 ${HEAD} の CI がまだありません`]);
    }
  });

  it('gh failure exits 2 with its message', async () => {
    const { lines, deps } = harness({
      gh: () => ({ status: 1, stdout: '', stderr: 'gh: not logged in' }),
    });
    expect(await main(['m2/x'], deps)).toBe(2);
    expect(lines).toEqual(['ci-gate: gh で CI の状態を読めません: gh: not logged in']);
  });

  it('unreadable gh output exits 2', async () => {
    const { lines, deps } = harness({ gh: () => ({ status: 0, stdout: 'nope', stderr: '' }) });
    expect(await main(['m2/x'], deps)).toBe(2);
    expect(lines[0]).toContain('ci-gate: gh で CI の状態を読めません:');
  });

  it('a missing branch argument exits 2', async () => {
    const { lines, deps } = harness();
    expect(await main([], deps)).toBe(2);
    expect(lines[0]).toContain('ブランチ名');
  });

  it('settings.json runs ci-gate on SessionStart', () => {
    const settings = JSON.parse(readFileSync(join(ROOT, '.claude/settings.json'), 'utf8'));
    const hooks = settings.hooks?.SessionStart as Array<{ hooks: Array<{ command: string }> }>;
    const commands = hooks.flatMap((h) => h.hooks.map((x) => x.command));
    const command = commands.find((c) => c.includes('scripts/ci-gate.mjs')) ?? '';
    expect(command).toContain('git config insta.integrationBranch');
    expect(command).toContain('main');
    // The session must never be stopped by the script's exit code.
    expect(command).toMatch(/\|\| true$/);
  });

  it('the delivery rule requires ci-gate before dispatch and after push', () => {
    const text = readFileSync(join(ROOT, '.claude/rules/delivery.md'), 'utf8');
    const flat = text.replace(/\s+/g, ' ');
    expect(flat).toMatch(
      /Before dispatching, `node scripts\/ci-gate\.mjs <integration branch>` exits 0/,
    );
    expect(flat).toMatch(
      /After the push, `node scripts\/ci-gate\.mjs <integration branch>` exits 0 before the next one/,
    );
  });
});
