// Seeds the slot's D1 and bucket: `node scripts/seed/index.ts --profile demo|bench`. Bindings come from wrangler's getPlatformProxy (the slot's
// .wrangler/state and .dev.vars). Exit codes: 0 ok, 1 count mismatch / production / failure, 2 bad arguments.
import { getPlatformProxy } from 'wrangler';
import { parseArgs, runSeed, type SeedEnv } from '../../src/shared/db/seed/seed.ts';

const argv = process.argv.slice(2);
let code: number;
if (parseArgs(argv) === null) {
  console.log('使い方: node scripts/seed/index.ts --profile demo|bench');
  code = 2;
} else {
  const proxy = await getPlatformProxy<SeedEnv>();
  try {
    code = await runSeed(argv, { env: proxy.env, vars: process.env, log: (l) => console.log(l) });
  } catch (error) {
    console.error(`seed: 失敗しました: ${error instanceof Error ? error.message : String(error)}`);
    code = 1;
  } finally {
    await proxy.dispose();
  }
}
process.exit(code);
