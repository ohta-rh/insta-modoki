// int-budget: each integration test, run alone, stays within a quarter of its own timeout, so a
// loaded host (3-4x slower) does not turn it into a timeout (ADR-0059). Measures the files changed
// since `git merge-base HEAD origin/main`; `--all` measures every integration test.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RESULTS_PATH } from './int-budget-reporter.mjs';

export const BUDGET_RATIO = 0.25;

/** Integration tests with their own measured timeouts that take minutes or touch the bucket. */
export const EXCLUDED = ['src/shared/db/seed/seed.int.test.ts', 'scripts/slot.int.test.ts'];

const root = fileURLToPath(new URL('..', import.meta.url));
const DIRS = ['src', 'scripts', 'tests'];
const RERUNS = 2;

function walk(dir, out) {
  if (!existsSync(join(root, dir))) return;
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) walk(path, out);
    else if (entry.name.endsWith('.int.test.ts')) out.push(path);
  }
}

const git = (args) => spawnSync('git', args, { cwd: root, encoding: 'utf8' });

const defaultDeps = {
  log: (line) => console.log(line),
  listFiles: () => {
    const out = [];
    for (const d of DIRS) walk(d, out);
    return out.sort();
  },
  /** Changed integration tests since the merge-base with origin/main, or null without a base. */
  changedFiles: () => {
    const base = git(['merge-base', 'HEAD', 'origin/main']);
    if (base.status !== 0 || !base.stdout.trim()) return null;
    const diff = git(['diff', '--name-only', base.stdout.trim()]);
    const untracked = git(['ls-files', '--others', '--exclude-standard']);
    if (diff.status !== 0 || untracked.status !== 0) return null;
    return [...diff.stdout.split('\n'), ...untracked.stdout.split('\n')]
      .filter((f) => f.endsWith('.int.test.ts') && existsSync(join(root, f)))
      .sort();
  },
  runVitest: (files) => {
    const resultsPath = join(root, RESULTS_PATH);
    rmSync(resultsPath, { force: true });
    const { status } = spawnSync(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        ...files,
        '--no-file-parallelism',
        '--reporter=default',
        '--reporter=./scripts/int-budget-reporter.mjs',
      ],
      { cwd: root, stdio: 'inherit' },
    );
    const results = existsSync(resultsPath) ? JSON.parse(readFileSync(resultsPath, 'utf8')) : [];
    return { status: status ?? 1, results };
  },
};

const keyOf = (r) => `${r.file}\u0000${r.name}`;
const budgetOf = (r) => r.timeoutMs * BUDGET_RATIO;

/** Returns the exit code: 0 within budget, 1 over budget, vitest's own code if it failed, 2 bad args. */
export function main(argv, deps = defaultDeps) {
  const { log, listFiles, changedFiles, runVitest } = { ...defaultDeps, ...deps };
  let all = false;
  for (const arg of argv) {
    if (arg === '--all') all = true;
    else {
      log(`int-budget: 不明な引数: ${arg}`);
      return 2;
    }
  }
  let files;
  if (all) {
    files = listFiles();
  } else {
    const changed = changedFiles();
    if (changed === null) {
      log('int-budget: 基準のコミットが無いので全ての結合テストを測ります');
      files = listFiles();
    } else {
      files = changed;
    }
  }
  files = files.filter((f) => !EXCLUDED.includes(f));
  if (files.length === 0) {
    log('int-budget: 変わった結合テストなし');
    return 0;
  }

  const first = runVitest(files);
  if (first.status !== 0) return first.status;
  const best = new Map(first.results.map((r) => [keyOf(r), r]));
  const slowFiles = () => [
    ...new Set([...best.values()].filter((r) => r.durationMs > budgetOf(r)).map((r) => r.file)),
  ];
  const suspects = slowFiles();
  for (let i = 0; i < RERUNS && suspects.length > 0; i += 1) {
    const rerun = runVitest(suspects);
    if (rerun.status !== 0) return rerun.status;
    for (const r of rerun.results) {
      const prev = best.get(keyOf(r));
      if (prev && r.durationMs < prev.durationMs) best.set(keyOf(r), r);
    }
  }

  const over = [...best.values()].filter((r) => r.durationMs > budgetOf(r));
  for (const r of over) {
    log(
      `int-budget: FAIL ${r.file} › ${r.name} ${Math.round(r.durationMs)}ms > ${budgetOf(r)}ms（上限 ${r.timeoutMs}ms）`,
    );
  }
  if (over.length > 0) {
    log(
      `int-budget: ${over.length} 件が予算（上限の 25%）を超えました。往復をまとめるか、計測した時間を書いて個別の上限を付けてください`,
    );
    return 1;
  }
  log(`int-budget: OK ${best.size} 件（全て上限の 25% 以内）`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
