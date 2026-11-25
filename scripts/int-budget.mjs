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

const git = (args, cwd = root) => spawnSync('git', args, { cwd, encoding: 'utf8' });

/**
 * The commit to compare against: `INT_BUDGET_BASE` if it resolves; otherwise, among `origin/$GITHUB_BASE_REF`,
 * every `origin/m*\/*` (integration branches) and `origin/main`, the merge-base with the fewest
 * commits up to HEAD (the closest branch point). Null when nothing resolves.
 * @param {{ cwd?: string, env?: Record<string, string | undefined> }} [options]
 */
export function resolveBase({ cwd = root, env = process.env } = {}) {
  const mergeBase = (ref) => {
    const out = git(['merge-base', 'HEAD', ref], cwd);
    return out.status === 0 && out.stdout.trim() ? out.stdout.trim() : null;
  };
  if (env.INT_BUDGET_BASE) {
    const base = mergeBase(env.INT_BUDGET_BASE);
    if (base) return base;
  }
  const candidates = [];
  if (env.GITHUB_BASE_REF) candidates.push(`origin/${env.GITHUB_BASE_REF}`);
  const refs = git(['for-each-ref', '--format=%(refname:short)', 'refs/remotes/origin/m*/*'], cwd);
  if (refs.status === 0) candidates.push(...refs.stdout.split('\n').filter(Boolean));
  candidates.push('origin/main');
  let best = null;
  for (const ref of candidates) {
    const base = mergeBase(ref);
    if (!base) continue;
    const count = git(['rev-list', '--count', `${base}..HEAD`], cwd);
    if (count.status !== 0) continue;
    const n = Number(count.stdout.trim());
    if (best === null || n < best.n) best = { base, n };
  }
  return best?.base ?? null;
}

/**
 * Changed integration tests (committed, modified or untracked) since the base, or null without a base.
 * @param {{ cwd?: string, env?: Record<string, string | undefined> }} [options]
 */
export function changedIntegrationFiles({ cwd = root, env = process.env } = {}) {
  const base = resolveBase({ cwd, env });
  if (base === null) return null;
  const diff = git(['diff', '-z', '--name-only', base, '--'], cwd);
  const untracked = git(['ls-files', '-z', '--others', '--exclude-standard'], cwd);
  if (diff.status !== 0 || untracked.status !== 0) return null;
  return [...new Set([...diff.stdout.split('\0'), ...untracked.stdout.split('\0')])]
    .filter((f) => f.endsWith('.int.test.ts') && existsSync(join(cwd, f)))
    .sort();
}

const defaultDeps = {
  log: (line) => console.log(line),
  listFiles: () => {
    const out = [];
    for (const d of DIRS) walk(d, out);
    return out.sort();
  },
  changedFiles: () => changedIntegrationFiles(),
  runVitest: (files) => {
    const resultsPath = join(root, RESULTS_PATH);
    rmSync(resultsPath, { force: true });
    const { status } = spawnSync(
      'pnpm',
      [
        'exec',
        'vitest',
        'run',
        '--no-file-parallelism',
        '--reporter=default',
        '--reporter=./scripts/int-budget-reporter.mjs',
        ...files,
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
  // vitest has no `--` for filters (it ignores what follows), so a name that looks like an option is dropped.
  files = files.filter((f) => !EXCLUDED.includes(f) && !f.startsWith('-'));
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
