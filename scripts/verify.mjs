// verify: runs every check in a fixed order and stops at the first failure (ADR-0024).
// Add a step by adding an entry to STEPS; docs/guides/verify.md must list the same steps.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Line coverage (%) required for src/**\/model/** and src/shared/config/**. */
export const COVERAGE_LINES = 80;

export const meetsCoverage = (linePercent) => linePercent >= COVERAGE_LINES;

export const STEPS = [
  { name: 'typecheck', command: 'pnpm typecheck' },
  { name: 'lint', command: 'pnpm lint' },
  { name: 'format', command: 'pnpm format:check' },
  { name: 'docs', command: 'node scripts/check-docs.mjs docs' },
  {
    name: 'unit',
    command: 'pnpm exec vitest run --coverage --exclude "**/*.int.test.ts"',
  },
  {
    name: 'integration',
    command: 'pnpm exec vitest run --passWithNoTests .int.test.ts',
    skipUnlessIntegrationTests: true,
  },
  { name: 'build', command: 'pnpm build' },
  { name: 'e2e', command: 'pnpm e2e' },
  // Fast (one page load): the initial JS stays within budget. Needs the build (ADR-0046).
  { name: 'perf-budget', command: 'node scripts/perf/bundle.mjs' },
];

/** Added only by `--with-perf` (slow: Lighthouse x 9, INP, 220 feed requests; needs `seed:bench`). */
export const PERF_STEP = { name: 'perf', command: 'node scripts/perf/run.mjs' };

const root = fileURLToPath(new URL('..', import.meta.url));

/** Directories searched for `*.int.test.ts` (scripts/ holds the slot script's integration test). */
export const INTEGRATION_DIRS = ['src', 'scripts', 'tests'];

export function findIntegrationTests(dir) {
  if (!existsSync(dir)) return false;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (findIntegrationTests(path)) return true;
    } else if (entry.name.endsWith('.int.test.ts')) {
      return true;
    }
  }
  return false;
}

const defaultDeps = {
  exec: (command) => spawnSync(command, { shell: true, stdio: 'inherit', cwd: root }).status,
  log: (line) => console.log(line),
  /** @type {Record<string, string | undefined>} */
  env: process.env,
  hasIntegrationTests: () => INTEGRATION_DIRS.some((d) => findIntegrationTests(join(root, d))),
};

/** Returns the process exit code: 0 ok, the failed command's code (or 1), 2 for bad arguments. */
export function main(argv, deps = defaultDeps) {
  const { exec, log, hasIntegrationTests, env } = { ...defaultDeps, ...deps };
  let only = null;
  let list = false;
  let withPerf = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--list') list = true;
    else if (argv[i] === '--with-perf') withPerf = true;
    else if (argv[i] === '--only' && argv[i + 1] !== undefined) only = argv[++i];
    else {
      log(`verify: 不明な引数: ${argv[i]}`);
      return 2;
    }
  }
  const all = withPerf ? [...STEPS, PERF_STEP] : STEPS;
  if (list) {
    for (const step of all) log(step.name);
    return 0;
  }
  const steps = only === null ? all : all.filter((s) => s.name === only);
  if (only !== null && steps.length === 0) {
    log(`verify: 不明な手順: ${only}`);
    return 2;
  }
  for (const step of steps) {
    log(`verify: ${step.name} ...`);
    if (step.skipUnlessIntegrationTests && !hasIntegrationTests()) {
      log(`${step.name}: テストなし`);
    } else {
      if (step.name === 'integration' && env.SLOT_INT !== '1') {
        log(
          'integration: scripts/slot.int.test.ts は SLOT_INT=1 が無いので飛ばします（スロットのバケットを空にするため。ADR-0023）',
        );
      }
      const status = exec(step.command);
      if (status !== 0) {
        log(`verify: FAIL ${step.name}`);
        return typeof status === 'number' && status !== 0 ? status : 1;
      }
    }
    log(`verify: ${step.name} OK`);
  }
  log('verify: OK');
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
