import { jobs as registry } from './index.ts';
import type { Job, JobEnv } from './types.ts';

export type JobCliIo = {
  env: JobEnv;
  now: Date;
  out: (line: string) => void;
  err: (line: string) => void;
  /** Tests replace the registry. */
  jobs?: Record<string, Job>;
};

/**
 * `pnpm jobs:run <name>`: runs one registered job. Exit codes: 0 ok, 1 the job failed (named
 * only, never its message), 2 unknown or missing name.
 */
export async function runJobCli(argv: string[], io: JobCliIo): Promise<number> {
  const jobs: Record<string, Job> = io.jobs ?? registry;
  const name = argv[0] ?? '';
  const job = Object.hasOwn(jobs, name) ? jobs[name] : undefined;
  if (!job) {
    io.err(`知らないジョブです: ${name}`);
    io.err(`登録済みのジョブ: ${Object.keys(jobs).join(', ')}`);
    return 2;
  }
  try {
    const { deleted } = await job({ env: io.env, now: io.now });
    io.out(`${name}: deleted=${deleted}`);
    return 0;
  } catch {
    io.err(`${name}: 失敗しました`);
    return 1;
  }
}
