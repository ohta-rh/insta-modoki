// verify: runs every check in a fixed order and stops at the first failure (ADR-0024).
// Add a step by adding an entry to STEPS; docs/guides/verify.md must list the same steps.
import { execFileSync, spawn } from 'node:child_process';
import {
  existsSync,
  linkSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { availableParallelism, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
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
    command:
      'pnpm exec vitest run --passWithNoTests .int.test.ts --exclude src/shared/db/seed/seed.int.test.ts',
    skipUnlessIntegrationTests: true,
  },
  // The bench seed floods the shared Garage, so it runs after, not beside, the other tests (ADR-0058).
  {
    name: 'integration-seed',
    command: 'pnpm exec vitest run src/shared/db/seed/seed.int.test.ts',
    skipUnlessIntegrationTests: true,
  },
  // Each changed integration test, alone, stays within 25% of its timeout (ADR-0059).
  { name: 'int-budget', command: 'node scripts/int-budget.mjs' },
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

/** How long a verify waits for another one to finish, and how often it looks again (ADR-0062). */
export const LOCK_WAIT_LIMIT_MS = 60 * 60_000;
export const LOCK_POLL_MS = 10_000;
const LOCK_NOTICE_MS = 60_000;

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
const lockPath = () => resolve(root, git('rev-parse', '--git-common-dir'), 'insta-verify.lock');

/** An unparsable lock younger than this is a lock being written elsewhere, so it counts as live. */
export const LOCK_YOUNG_MS = 5_000;

const realFs = { writeFileSync, linkSync, unlinkSync, readFileSync, statSync };

/**
 * The lock file. `path` is a string or a function returning one; `fsOps` and `now` are injectable.
 * `create` writes the full JSON to `<lock>.<pid>.tmp` and hard-links it to the lock (EEXIST when held),
 * so the lock never exists empty.
 * @param {string | (() => string)} path
 * @param {{ writeFileSync: Function, linkSync: Function, unlinkSync: Function, readFileSync: Function, statSync: Function }} [fsOps]
 * @param {() => number} [now]
 */
export function createFileLock(path, fsOps = realFs, now = () => Date.now()) {
  const at = () => (typeof path === 'function' ? path() : path);
  return {
    create: (info) => {
      const tmp = `${at()}.${info.pid}.tmp`;
      fsOps.writeFileSync(tmp, `${JSON.stringify(info)}\n`);
      try {
        fsOps.linkSync(tmp, at());
        return true;
      } catch (error) {
        if (error.code === 'EEXIST') return false;
        throw error;
      } finally {
        try {
          fsOps.unlinkSync(tmp);
        } catch {
          // already gone
        }
      }
    },
    /** null: no lock. An unparsable file reads as `{ pid: NaN }`, plus `young: true` under 5 s old. */
    read: () => {
      let text;
      try {
        text = fsOps.readFileSync(at(), 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
      }
      try {
        const info = JSON.parse(text);
        if (typeof info === 'object' && info !== null) return info;
      } catch {
        // fall through: unparsable
      }
      try {
        const young = now() - fsOps.statSync(at()).mtimeMs < LOCK_YOUNG_MS;
        return young ? { pid: Number.NaN, young: true } : { pid: Number.NaN };
      } catch {
        return null; // vanished meanwhile
      }
    },
    remove: () => {
      try {
        fsOps.unlinkSync(at());
      } catch (error) {
        if (error.code !== 'ENOENT') throw error;
      }
    },
  };
}

/** The running step, so a signal can stop it (exec is async so signals are handled while it runs). */
let child = null;

const defaultDeps = {
  /** @type {(command: string) => number | null | Promise<number | null>} */
  exec: (command) =>
    new Promise((resolveExec) => {
      child = spawn(command, { shell: true, stdio: 'inherit', cwd: root });
      child.on('error', () => resolveExec(1));
      child.on('close', (code) => {
        child = null;
        resolveExec(code);
      });
    }),
  log: (line) => console.log(line),
  /** @type {Record<string, string | undefined>} */
  env: process.env,
  hasIntegrationTests: () => INTEGRATION_DIRS.some((d) => findIntegrationTests(join(root, d))),
  pid: process.pid,
  worktree: root,
  now: () => Date.now(),
  sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
  /** `kill(pid, 0)`: ESRCH = gone; EPERM = alive but not ours. */
  isAlive: (pid) => {
    if (!Number.isInteger(pid) || pid <= 0) return false;
    try {
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return error.code === 'EPERM';
    }
  },
  lock: createFileLock(lockPath),
  git: () => ({
    head: git('rev-parse', 'HEAD'),
    branch: git('branch', '--show-current') || 'detached',
  }),
  load: () => ({ load1: loadavg()[0], cpus: availableParallelism() }),
  /** Calls `handler(signal?)` on exit, SIGINT and SIGTERM; returns the function that removes it. */
  onExit: (handler) => {
    const onExit = () => handler();
    const onInt = () => {
      child?.kill('SIGINT');
      handler('SIGINT');
      process.exit(130);
    };
    const onTerm = () => {
      child?.kill('SIGTERM');
      handler('SIGTERM');
      process.exit(143);
    };
    process.on('exit', onExit);
    process.on('SIGINT', onInt);
    process.on('SIGTERM', onTerm);
    return () => {
      process.off('exit', onExit);
      process.off('SIGINT', onInt);
      process.off('SIGTERM', onTerm);
    };
  },
};

const short = (sha) => sha.slice(0, 7);

/**
 * Takes the machine-wide verify lock (ADR-0062). Returns `{ info, branch }` when held, null after waiting too long.
 * A lock whose pid is not alive is taken over; a live one is waited for.
 */
async function acquireLock(d) {
  const startedWaiting = d.now();
  let waitingNoticed = false;
  let nextNoticeAt = LOCK_NOTICE_MS;
  for (;;) {
    // HEAD is read at every attempt, so the one recorded is the one read when the lock is won.
    const state = d.git();
    const info = {
      pid: d.pid,
      head: short(state.head),
      worktree: d.worktree,
      startedAt: new Date(d.now()).toISOString(),
    };
    if (d.lock.create(info)) return { info, branch: state.branch };
    const holder = d.lock.read();
    if (holder === null) continue; // released between create and read: try again
    if (!holder.young && !d.isAlive(holder.pid)) {
      d.log(`verify: 終わっていない verify（pid ${holder.pid}）のロックを引き継ぎます`);
      d.lock.remove();
      continue;
    }
    const waited = d.now() - startedWaiting;
    if (waited > LOCK_WAIT_LIMIT_MS) {
      d.log('verify: 60 分待っても別の verify が終わりません');
      return null;
    }
    const who = Number.isNaN(holder.pid) ? '不明' : holder.pid;
    if (!waitingNoticed) {
      d.log(`verify: 別の verify（pid ${who}、${holder.worktree ?? '不明'}）が終わるまで待ちます`);
      waitingNoticed = true;
    } else if (waited >= nextNoticeAt) {
      d.log(
        `verify: 別の verify（pid ${who}、${holder.worktree ?? '不明'}）を ${Math.floor(waited / 60_000)} 分待っています`,
      );
    }
    while (waited >= nextNoticeAt) nextNoticeAt += LOCK_NOTICE_MS;
    await d.sleep(LOCK_POLL_MS);
  }
}

/** Returns the process exit code: 0 ok, the failed command's code (or 1), 2 for bad arguments. */
export async function main(argv, deps = defaultDeps) {
  const d = { ...defaultDeps, ...deps };
  const { exec, log, hasIntegrationTests, env } = d;
  let only = null;
  const skip = [];
  let list = false;
  let withPerf = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--list') list = true;
    else if (argv[i] === '--with-perf') withPerf = true;
    else if (argv[i] === '--only' && argv[i + 1] !== undefined) only = argv[++i];
    else if (argv[i] === '--skip' && argv[i + 1] !== undefined) skip.push(argv[++i]);
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
  if (only !== null && skip.length > 0) {
    log('verify: --only と --skip は同時に指定できません');
    return 2;
  }
  const unknown = skip.find((name) => !all.some((s) => s.name === name));
  if (unknown !== undefined) {
    log(`verify: 不明な手順: ${unknown}`);
    return 2;
  }
  const steps =
    only === null ? all.filter((s) => !skip.includes(s.name)) : all.filter((s) => s.name === only);
  if (only !== null && steps.length === 0) {
    log(`verify: 不明な手順: ${only}`);
    return 2;
  }

  // Only our own lock is ever removed (a taken-over lock now belongs to another pid).
  const release = () => {
    if (d.lock.read()?.pid === d.pid) d.lock.remove();
  };
  const held = await acquireLock(d);
  if (held === null) return 1;
  const startHead = held.info.head;
  const stopListening = d.onExit(release);
  try {
    log(`verify: HEAD ${startHead} ${held.branch}`);
    const { load1, cpus } = d.load();
    log(`verify: load average ${load1} / CPU ${cpus}`);
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
        const status = await exec(step.command);
        if (status !== 0) {
          log(`verify: FAIL ${step.name}`);
          return typeof status === 'number' && status !== 0 ? status : 1;
        }
      }
      log(`verify: ${step.name} OK`);
    }
    const endHead = short(d.git().head);
    if (endHead !== startHead) {
      log(`verify: FAIL HEAD が実行中に ${startHead} から ${endHead} に変わりました`);
      return 1;
    }
    log(`verify: OK ${startHead}`);
    return 0;
  } finally {
    release();
    stopListening();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = await main(process.argv.slice(2));
}
