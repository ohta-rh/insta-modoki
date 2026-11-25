// harness-drift: tells whether the main checkout's CLAUDE.md and .claude/ match origin/<integration branch> (ADR-0072).
// Read-only: compares HEAD (not the working tree) with the remote branch. Exit: 0 same, 1 differs, 2 bad arguments or git failure.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const MAX_LISTED = 20;

const defaultDeps = {
  git: (args) => {
    const r = spawnSync('git', args, { encoding: 'utf8' });
    return {
      status: r.status ?? 1,
      stdout: r.stdout ?? '',
      stderr: r.error ? String(r.error.message) : (r.stderr ?? ''),
    };
  },
  log: (line) => console.log(line),
};

export async function main(argv, deps = defaultDeps) {
  const { git, log } = deps;
  const branch = argv[0];
  if (!branch) {
    log(
      'harness-drift: ブランチ名を 1 つ渡してください（例: node scripts/harness-drift.mjs main）',
    );
    return 2;
  }
  const remote = `origin/${branch}`;

  if (git(['rev-parse', '--verify', '--quiet', remote]).status !== 0) {
    log(`harness-drift: ${remote} を読めません（git fetch origin を流してください）`);
    return 2;
  }
  const diff = git(['diff', '--name-only', 'HEAD', remote, '--', 'CLAUDE.md', '.claude']);
  if (diff.status !== 0) {
    const why = diff.stderr.trim().split('\n')[0] || `終了コード ${diff.status}`;
    log(`harness-drift: git diff が失敗しました: ${why}`);
    return 2;
  }

  const changed = diff.stdout.split('\n').filter(Boolean);
  if (changed.length === 0) {
    log(`harness-drift: main checkout のハーネスは ${remote} と同じです`);
    return 0;
  }
  log(
    `harness-drift: main checkout のハーネスが ${remote} と違います。main checkout で git switch ${branch} してください`,
  );
  for (const path of changed.slice(0, MAX_LISTED)) log(`  ${path}`);
  if (changed.length > MAX_LISTED) log(`  ほか ${changed.length - MAX_LISTED} 件`);
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
