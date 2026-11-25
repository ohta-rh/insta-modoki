// ci-gate: reads the latest CI run of an integration branch and says whether work may go on (ADR-0067).
// Read-only: it never pushes and never re-runs. Exit: 0 green, 1 red, 2 tool failure, 3 wait.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.error ? String(r.error.message) : (r.stderr ?? ''),
  };
};

const defaultDeps = {
  gh: (args) => run('gh', args),
  /** The branch head, or null when `origin/<branch>` cannot be resolved. */
  revParse: (ref) => {
    const r = run('git', ['rev-parse', '--verify', '--quiet', ref]);
    return r.status === 0 ? r.stdout.trim() : null;
  },
  log: (line) => console.log(line),
};

export async function main(argv, deps = defaultDeps) {
  const { gh, revParse, log } = deps;
  const branch = argv[0];
  if (!branch) {
    log('ci-gate: ブランチ名を 1 つ渡してください（例: node scripts/ci-gate.mjs main）');
    return 2;
  }

  const listed = gh([
    'run',
    'list',
    '--branch',
    branch,
    '--workflow',
    'CI',
    '--limit',
    '1',
    '--json',
    'headSha,status,conclusion,url',
  ]);
  let runs;
  let failure = listed.status === 0 ? '' : listed.stderr.trim() || `終了コード ${listed.status}`;
  if (!failure) {
    try {
      runs = JSON.parse(listed.stdout);
      if (!Array.isArray(runs)) failure = '出力が配列ではありません';
    } catch (e) {
      failure = `出力を読めません: ${e.message}`;
    }
  }
  if (failure) {
    log(`ci-gate: gh で CI の状態を読めません: ${failure}`);
    return 2;
  }

  const head = revParse(`origin/${branch}`);
  const latest = runs[0];
  if (head && (!latest || latest.headSha !== head)) {
    log(`ci-gate: 先頭 ${head} の CI がまだありません`);
    return 3;
  }
  if (!latest) {
    log(`ci-gate: ${branch} の CI の実行がまだありません`);
    return 3;
  }

  if (latest.status !== 'completed') {
    log(`ci-gate: ${latest.headSha} の CI は実行中です`);
    return 3;
  }
  if (latest.conclusion === 'success') {
    log(`ci-gate: ${branch} は緑です（${latest.headSha}）`);
    return 0;
  }
  log(
    `ci-gate: ${branch} の最新の CI（${latest.headSha}）は ${latest.conclusion} です。ほかの作業より先に直してください: ${latest.url}`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
