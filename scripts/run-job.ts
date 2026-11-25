// Runs one scheduled job by hand: `node scripts/run-job.ts <name>` (`pnpm jobs:run <name>`).
// Bindings come from wrangler's getPlatformProxy (the slot's .wrangler/state and .dev.vars), the
// same code the Cron Trigger runs (ADR-0049). Exit codes: 0 ok, 1 the job failed, 2 bad name.
import { getPlatformProxy } from 'wrangler';
import { runJobCli } from '../src/jobs/cli.ts';
import type { JobEnv } from '../src/jobs/types.ts';

const proxy = await getPlatformProxy<JobEnv>();
let code: number;
try {
  code = await runJobCli(process.argv.slice(2), {
    env: proxy.env,
    now: new Date(),
    out: (line) => console.log(line),
    err: (line) => console.error(line),
  });
} finally {
  await proxy.dispose();
}
process.exit(code);
