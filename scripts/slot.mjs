#!/usr/bin/env node
// Prepare, reset or drop a worktree's slot on the shared compose stack (ADR-0008, ADR-0023).
//   node scripts/slot.mjs <prepare|reset|drop> <N>        N is 0..4 (0 = main checkout; app port 3100 + N)
//   node scripts/slot.mjs status                          Garage's MklTodo / GcTodo of the object table
// Exit codes: 0 success, 1 stack down or a command failed, 2 bad arguments.
// The DB is D1 (files in .wrangler/state of the current directory); the bucket lives in Garage.
import { createHash, createHmac, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const S3_ENDPOINT = process.env.SLOT_S3_ENDPOINT ?? 'http://localhost:3910';
const S3_REGION = 'auto';
// Garage's web endpoint (published on host 3912) serves a bucket at <bucket>.web.localhost; the S3 API
// refuses anonymous GET, so images are read here (ADR-0037). Chrome resolves *.localhost to 127.0.0.1.
const MEDIA_PORT = process.env.SLOT_MEDIA_PORT ?? '3912';
const KEY_NAME = 'insta-local';
const COMPOSE_PROJECT = 'insta-modoki';
const STACK_DOWN =
  '共有のスタックが起動していません。Director が docker compose up -d --wait を実行してください';

/** The slot integration test empties buckets of shared slots, so it runs only on request (ADR-0023). */
export const slotIntEnabled = (env) => env.SLOT_INT === '1';

export function slotNames(n) {
  const text = String(n);
  if (!/^[0-4]$/.test(text)) throw new Error('slot は 0〜4 の整数です');
  const i = Number(text);
  return { db: `insta_s${i}`, testDb: `insta_s${i}_test`, bucket: `insta-s${i}`, port: 3100 + i };
}

export function renderEnv(n, { accessKey, secretKey, authPepper, authSecret }) {
  const { bucket, port } = slotNames(n);
  const mediaOrigin = `http://${bucket}.web.localhost:${MEDIA_PORT}`;
  return (
    [
      ['SLOT', n],
      ['PORT', port],
      ['BETTER_AUTH_URL', `http://localhost:${port}`],
      ['BETTER_AUTH_SECRET', authSecret],
      ['AUTH_PEPPER', authPepper],
      ['S3_ENDPOINT', S3_ENDPOINT],
      ['S3_REGION', S3_REGION],
      ['S3_BUCKET', bucket],
      ['S3_ACCESS_KEY', accessKey],
      ['S3_SECRET_KEY', secretKey],
      ['S3_PUBLIC_BASE_URL', mediaOrigin],
      ['MEDIA_ORIGIN', mediaOrigin],
    ]
      .map(([k, v]) => `${k}=${v}`)
      .join('\n') + '\n'
  );
}

/** @param {string} text @returns {Record<string, string>} */
export function parseEnv(text) {
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of text.split('\n')) {
    const i = line.indexOf('=');
    if (i > 0 && !line.startsWith('#')) out[line.slice(0, i)] = line.slice(i + 1);
  }
  return out;
}

// --- Minimal S3 client (SigV4, path style) for emptying buckets and for tests ---

const hash = (s) => createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => createHmac('sha256', k).update(s).digest();
const enc = (s) =>
  encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );

async function s3Request(
  { endpoint, region, accessKey, secretKey, bucket },
  method,
  key,
  query = {},
  body = '',
) {
  const url = new URL(endpoint);
  const path = `/${bucket}${key ? `/${key.split('/').map(enc).join('/')}` : ''}`;
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${enc(k)}=${enc(query[k])}`)
    .join('&');
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const day = amzDate.slice(0, 8);
  const payloadHash = hash(body);
  const headers = { host: url.host, 'x-amz-content-sha256': payloadHash, 'x-amz-date': amzDate };
  const signed = Object.keys(headers).sort();
  const canonical = [
    method,
    path,
    canonicalQuery,
    signed.map((h) => `${h}:${headers[h]}\n`).join(''),
    signed.join(';'),
    payloadHash,
  ].join('\n');
  const scope = `${day}/${region}/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, hash(canonical)].join('\n');
  const signingKey = hmac(hmac(hmac(hmac(`AWS4${secretKey}`, day), region), 's3'), 'aws4_request');
  const signature = createHmac('sha256', signingKey).update(toSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signed.join(';')}, Signature=${signature}`;
  const res = await fetch(
    `${endpoint.replace(/\/$/, '')}${path}${canonicalQuery ? `?${canonicalQuery}` : ''}`,
    {
      method,
      headers: { ...headers, authorization },
      body: body === '' ? undefined : body,
    },
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`S3 ${method} ${path} -> ${res.status} ${text.slice(0, 200)}`);
  return text;
}

/** The bucket's CORS rule: the slot's own app origin may PUT (signed upload), GET and HEAD. */
export function corsXml(n) {
  const { port } = slotNames(n);
  return (
    '<CORSConfiguration><CORSRule>' +
    `<AllowedOrigin>http://localhost:${port}</AllowedOrigin>` +
    '<AllowedMethod>PUT</AllowedMethod><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod>' +
    '<AllowedHeader>content-type</AllowedHeader><AllowedHeader>content-length</AllowedHeader>' +
    '<ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3000</MaxAgeSeconds>' +
    '</CORSRule></CORSConfiguration>'
  );
}

/** Sets the rule above on the bucket (replaces any earlier one, so it is idempotent). */
export const putBucketCors = (cfg, n) => s3Request(cfg, 'PUT', '', { cors: '' }, corsXml(n));

export const putObject = (cfg, key, body) => s3Request(cfg, 'PUT', key, {}, body);
export const deleteObject = (cfg, key) => s3Request(cfg, 'DELETE', key);

const unxml = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');

export async function listObjects(cfg) {
  const keys = [];
  let token;
  do {
    const xml = await s3Request(cfg, 'GET', '', {
      'list-type': '2',
      ...(token ? { 'continuation-token': token } : {}),
    });
    for (const m of xml.matchAll(/<Key>([^<]*)<\/Key>/g)) keys.push(unxml(m[1]));
    token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
      ? unxml(/<NextContinuationToken>([^<]*)</.exec(xml)?.[1] ?? '')
      : undefined;
  } while (token);
  return keys;
}

export const DELETE_CONCURRENCY = 32;
const PROGRESS_EVERY = 10_000;

/**
 * Deletes every object in the bucket, `concurrency` DELETEs at a time (one at a time took 20 ms
 * each: 450,000 objects = 2.5 h; 32 at a time ~1-4 ms each, ADR-0060). Prints progress every
 * 10,000 objects and at the end. After the first failure no new DELETE starts; the ones running
 * finish, then the first error is thrown. Deleting a missing key succeeds, so a rerun is safe.
 *
 * @param {{ bucket: string }} cfg
 * @param {{
 *   list?: (cfg: any) => Promise<string[]>,
 *   del?: (cfg: any, key: string) => Promise<unknown>,
 *   out?: (line: string) => unknown,
 *   concurrency?: number,
 * }} [deps]
 */
export async function emptyBucket(
  cfg,
  {
    list = listObjects,
    del = deleteObject,
    out = (s) => process.stdout.write(`${s}\n`),
    concurrency = DELETE_CONCURRENCY,
  } = {},
) {
  const keys = await list(cfg);
  const total = keys.length;
  if (total === 0) {
    out(`バケット ${cfg.bucket} は空です`);
    return;
  }
  let next = 0;
  let done = 0;
  let failed = false;
  let firstError;
  const worker = async () => {
    while (!failed && next < total) {
      const key = keys[next++];
      try {
        await del(cfg, key);
      } catch (e) {
        if (!failed) firstError = e;
        failed = true;
        return;
      }
      done++;
      if (done % PROGRESS_EVERY === 0 && done !== total)
        out(`バケット ${cfg.bucket} のオブジェクトを ${done} / ${total} 個消しました`);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, total) }, worker));
  if (failed) throw firstError;
  out(`バケット ${cfg.bucket} のオブジェクトを ${done} / ${total} 個消しました`);
}

// --- Garage's merkle queue (#117, ADR-0063) ---

const DRAIN_THRESHOLD = 500;
const DRAIN_INTERVAL_MS = 30_000;
const DRAIN_TIMEOUT_MS = 1_800_000;
const GC_TODO_WARN = 1_000_000;

/**
 * Reads MklTodo and GcTodo of the `object` table from the text of `garage stats`
 * (the row of `Table stats` whose first column is `object`; MklTodo is column 4, GcTodo column 6).
 * @returns {{ mklTodo: number, gcTodo: number } | null} null when it cannot be read
 */
export function parseObjectQueues(text) {
  for (const line of text.split('\n')) {
    const cols = line.trim().split(/\s+/);
    if (cols[0] === 'object' && cols.length >= 6) {
      const mklTodo = Number(cols[3]);
      const gcTodo = Number(cols[5]);
      if (Number.isInteger(mklTodo) && Number.isInteger(gcTodo)) return { mklTodo, gcTodo };
    }
  }
  return null;
}

/**
 * Waits until the object table's MklTodo is below `threshold` (500 itself still waits), reading it
 * with `read` (null = unreadable). Prints a line every `intervalMs`; gives up after `timeoutMs`.
 * @returns {Promise<'drained' | 'timeout' | 'unreadable'>}
 */
export async function waitForGarageDrain(
  { n, read, out, sleep, now },
  {
    threshold = DRAIN_THRESHOLD,
    intervalMs = DRAIN_INTERVAL_MS,
    timeoutMs = DRAIN_TIMEOUT_MS,
  } = {},
) {
  const start = now();
  for (;;) {
    const q = read();
    if (!q) return 'unreadable';
    if (q.mklTodo < threshold) return 'drained';
    if (now() - start >= timeoutMs) {
      out.fail(
        `slot ${n}: 30 分待っても Garage の後始末が終わりません（MklTodo=${q.mklTodo}）。docs/guides/local-development.md の「Garage が重い」を見てください`,
      );
      return 'timeout';
    }
    out.info(`slot ${n}: Garage の後始末を待っています（MklTodo=${q.mklTodo}）`);
    await sleep(intervalMs);
  }
}

// --- Stopping the slot's app server (#83) ---

const TERM_WAIT_MS = 5000;
const POLL_MS = 100;

/** pid -> { ppid, command } from `ps`. */
function readProcesses(exec) {
  const procs = new Map();
  for (const row of exec('ps', ['-axo', 'pid=,ppid=,command=']).stdout.split('\n')) {
    const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(row);
    if (m) procs.set(Number(m[1]), { ppid: Number(m[2]), command: m[3] });
  }
  return procs;
}

/** The running process and all its ancestors: never a target, or `drop` would kill itself and its caller. */
function selfChain(procs, selfPid) {
  const chain = new Set([selfPid]);
  for (let p = procs.get(selfPid)?.ppid; p && p > 1 && !chain.has(p); p = procs.get(p)?.ppid)
    chain.add(p);
  return chain;
}

/**
 * PIDs listening on the TCP port (`lsof -ti`) plus the ancestors that were started for that port
 * (their command line has `--port <N>`, `--port=<N>` or `PORT=<N>`): stopping only the listener
 * leaves wrangler and the preview running. Empty when nobody is. Never climbs into a shell or a
 * process of another port, and never returns this process or its ancestors.
 */
export async function listPortPids(port, exec = realExec, selfPid = process.pid) {
  const r = exec('lsof', ['-ti', `tcp:${port}`, '-sTCP:LISTEN']);
  const listeners = [...new Set(r.stdout.split('\n').map((l) => Number(l.trim())))].filter(
    (p) => Number.isInteger(p) && p > 1,
  );
  if (listeners.length === 0) return [];
  const procs = readProcesses(exec);
  const self = selfChain(procs, selfPid);
  const mine = new RegExp(`(--port[ =]|\\bPORT=)${port}(\\s|$)`);
  const all = new Set(listeners);
  for (const pid of listeners) {
    for (
      let p = procs.get(pid)?.ppid;
      p && p > 1 && mine.test(procs.get(p)?.command ?? '');
      p = procs.get(p)?.ppid
    )
      all.add(p);
  }
  return [...all].filter((p) => !self.has(p));
}

/**
 * Signals pid and all its descendants, children first (the preview is sh -> wrangler -> node -> workerd).
 * This process and its ancestors are skipped.
 */
export function killTree(pid, signal, exec = realExec, selfPid = process.pid, send = process.kill) {
  if (!(pid > 1)) return; // PID 1 would walk every process on the host
  const procs = readProcesses(exec);
  const self = selfChain(procs, selfPid);
  const children = new Map();
  for (const [c, { ppid }] of procs) children.set(ppid, [...(children.get(ppid) ?? []), c]);
  const order = [];
  const seen = new Set();
  const walk = (p) => {
    if (seen.has(p)) return;
    seen.add(p);
    for (const c of children.get(p) ?? []) walk(c);
    order.push(p);
  };
  walk(pid);
  for (const p of order) {
    if (self.has(p)) continue;
    try {
      send(p, signal);
    } catch {
      // already gone
    }
  }
}

// --- The command ---

function realExec(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return {
    status: r.status ?? 1,
    stdout: r.stdout ?? '',
    stderr: r.stderr ?? (r.error ? String(r.error) : ''),
  };
}

export async function run(argv, deps = {}) {
  const exec = deps.exec ?? realExec;
  const cwd = deps.cwd ?? process.cwd();
  const out = deps.stdout ?? ((s) => process.stdout.write(`${s}\n`));
  const err = deps.stderr ?? ((s) => process.stderr.write(`${s}\n`));
  const randomHex = deps.randomHex ?? (() => randomBytes(32).toString('hex'));

  const [command, slotArg] = argv;
  const usage = '使い方: node scripts/slot.mjs <prepare|reset|drop> <N> | status';
  let names;
  try {
    if (command === 'status') {
      if (argv.length !== 1) throw new Error(usage);
    } else {
      if (!['prepare', 'reset', 'drop'].includes(command)) throw new Error(usage);
      names = slotNames(slotArg);
    }
  } catch (e) {
    err(e.message);
    return 2;
  }
  const n = Number(slotArg);

  if (command === 'drop' || command === 'reset') {
    const list = deps.listPortPids ?? listPortPids;
    const kill = deps.killTree ?? killTree;
    const sleep = deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    const found = await list(names.port);
    const waitFor = async (ms) => {
      let left = await list(names.port);
      for (let t = 0; left.length > 0 && t < ms; t += POLL_MS) {
        await sleep(POLL_MS);
        left = await list(names.port);
      }
      return left;
    };
    if (found.length > 0) {
      for (const pid of found) kill(pid, 'SIGTERM');
      let left = await waitFor(deps.termWaitMs ?? TERM_WAIT_MS);
      if (left.length > 0) {
        for (const pid of left) kill(pid, 'SIGKILL');
        left = await waitFor(1000);
      }
      if (left.length > 0) {
        err(
          `slot ${n} のポート ${names.port} を握るプロセスが止まりません（PID: ${left.join(', ')}）。消す処理には進みません`,
        );
        return 1;
      }
    }
    out(`slot ${n} のポート ${names.port} のプロセスを ${found.length} 個止めました`);
  }

  const ps = exec('docker', [
    'ps',
    '-q',
    '--filter',
    `label=com.docker.compose.project=${COMPOSE_PROJECT}`,
    '--filter',
    'label=com.docker.compose.service=s3',
    '--filter',
    'health=healthy',
  ]);
  const container = ps.stdout.trim().split('\n')[0];
  if (ps.status !== 0 || !container) {
    err(STACK_DOWN);
    return 1;
  }

  const garage = (...args) => exec('docker', ['exec', container, '/garage', ...args]);
  const readQueues = () => {
    const r = garage('stats');
    return r.status === 0 ? parseObjectQueues(r.stdout) : null;
  };
  /** Returns 0 when drained, else the exit code (1) after printing why. */
  const drain = async () => {
    const result = await waitForGarageDrain(
      {
        n,
        read: readQueues,
        out: { info: out, fail: err },
        sleep: deps.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
        now: deps.now ?? Date.now,
      },
      deps.drain,
    );
    if (result === 'unreadable') err(STACK_DOWN);
    return result === 'drained' ? 0 : 1;
  };

  if (command === 'status') {
    const q = readQueues();
    if (!q) {
      err(STACK_DOWN);
      return 1;
    }
    out(`Garage: MklTodo=${q.mklTodo} GcTodo=${q.gcTodo}`);
    if (q.gcTodo > GC_TODO_WARN)
      out(
        `GcTodo が ${GC_TODO_WARN} を超えています。ボリュームの作り直しは利用者が docker compose down -v で行ってください（全スロットのデータが消える）`,
      );
    return 0;
  }
  const field = (text, label) => new RegExp(`^${label}:\\s+(\\S+)`, 'm').exec(text)?.[1];
  const fail = (what, r) => {
    err(`${what} に失敗しました: ${(r.stderr || r.stdout).trim().split('\n').pop()}`);
    return 1;
  };

  // The single access key, created once.
  let info = garage('key', 'info', KEY_NAME, '--show-secret');
  if (info.status !== 0) {
    const created = garage('key', 'create', KEY_NAME);
    // A concurrent prepare on a fresh stack may have created it first: read it back once.
    info = created.status === 0 ? created : garage('key', 'info', KEY_NAME, '--show-secret');
    if (info.status !== 0) return fail('鍵の作成', created);
  }
  const accessKey = field(info.stdout, 'Key ID');
  const secretKey = field(info.stdout, 'Secret key');
  if (!accessKey || !secretKey) return fail('鍵の読み取り', info);
  const cfg = {
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    accessKey,
    secretKey,
    bucket: names.bucket,
  };

  const ensureBucket = () => {
    if (garage('bucket', 'info', names.bucket).status !== 0) {
      const r = garage('bucket', 'create', names.bucket);
      if (r.status !== 0) return r;
    }
    const allowed = garage(
      'bucket',
      'allow',
      '--read',
      '--write',
      '--owner',
      names.bucket,
      '--key',
      KEY_NAME,
    );
    if (allowed.status !== 0) return allowed;
    // Anonymous reads go through the web endpoint; allowing it again is a no-op.
    return garage('bucket', 'website', '--allow', names.bucket);
  };
  const state = join(cwd, '.wrangler', 'state');
  const envFile = join(cwd, '.dev.vars');

  try {
    if (command === 'drop') {
      if (garage('bucket', 'info', names.bucket).status === 0) {
        const r = ensureBucket();
        if (r.status !== 0) return fail('バケットの許可', r);
        await (deps.emptyBucket ?? emptyBucket)(cfg);
        const d = garage('bucket', 'delete', '--yes', names.bucket);
        if (d.status !== 0) return fail('バケットの削除', d);
        if ((await drain()) !== 0) return 1;
      }
      rmSync(state, { recursive: true, force: true });
      out(`slot ${n} を削除しました（${names.bucket}、.wrangler/state）。.dev.vars は残しています`);
      return 0;
    }

    if (command === 'reset') rmSync(state, { recursive: true, force: true });
    const b = ensureBucket();
    if (b.status !== 0) return fail('バケットの準備', b);
    await (deps.putCors ?? putBucketCors)(cfg, n);
    if (command === 'reset') {
      await (deps.emptyBucket ?? emptyBucket)(cfg);
      if ((await drain()) !== 0) return 1;
    }

    const prev = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
    rmSync(envFile, { force: true }); // never rewrite secrets into a file with an older, looser mode
    writeFileSync(
      envFile,
      renderEnv(n, {
        accessKey,
        secretKey,
        authPepper: prev.AUTH_PEPPER || randomHex(),
        authSecret: prev.BETTER_AUTH_SECRET || randomHex(),
      }),
      { mode: 0o600 },
    );

    if (existsSync(join(cwd, 'migrations'))) {
      const m = exec('pnpm', ['exec', 'wrangler', 'd1', 'migrations', 'apply', 'DB', '--local'], {
        cwd,
      });
      if (m.status !== 0) return fail('マイグレーション', m);
    }
    out(
      `slot ${n} を${command === 'reset' ? '初期化' : '準備'}しました（${names.bucket}、PORT=${names.port}、.dev.vars）`,
    );
    return 0;
  } catch (e) {
    err(`slot ${n} の ${command} に失敗しました: ${e.message}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await run(process.argv.slice(2));
}
