import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import {
  corsXml,
  emptyBucket,
  killTree,
  listPortPids,
  renderEnv,
  run,
  slotIntEnabled,
  slotNames,
} from './slot.mjs';

const secrets = {
  accessKey: 'access-key-for-test',
  secretKey: 'secret-key-for-test',
  authPepper: 'pepper-for-test',
  authSecret: 'auth-secret-for-test',
};

test('slot 0 と 4 の名前を返す', () => {
  assert.deepEqual(slotNames(0), {
    db: 'insta_s0',
    testDb: 'insta_s0_test',
    bucket: 'insta-s0',
    port: 3100,
  });
  assert.deepEqual(slotNames(4), {
    db: 'insta_s4',
    testDb: 'insta_s4_test',
    bucket: 'insta-s4',
    port: 3104,
  });
});

test('slot 5 のとき投げる', () => {
  assert.throws(() => slotNames(5), /slot は 0〜4 の整数です/);
});

test('slot -1 のとき投げる', () => {
  assert.throws(() => slotNames(-1), /slot は 0〜4 の整数です/);
});

test('slot に SQL の断片が入っていたら投げる', () => {
  assert.throws(() => slotNames('abc'), /slot は 0〜4 の整数です/);
  assert.throws(() => slotNames('1; DROP DATABASE x'), /slot は 0〜4 の整数です/);
});

test('スタックが止まっているとき、案内を出して 1 を返す', async () => {
  const calls: string[][] = [];
  const err: string[] = [];
  const code = await run(['prepare', '1'], {
    exec: (cmd: string, args: string[]) => {
      calls.push([cmd, ...args]);
      return { status: 0, stdout: '', stderr: '' };
    },
    cwd: '/nonexistent-slot-test',
    stderr: (s: string) => err.push(s),
    stdout: () => {},
  });
  assert.equal(code, 1);
  assert.match(
    err.join('\n'),
    /共有のスタックが起動していません。Director が docker compose up -d --wait を実行してください/,
  );
  // Only the "is the stack up" lookup ran; nothing was created.
  assert.equal(calls.length, 1);
  assert.ok(calls.every((c) => c[0] === 'docker' && c[1] === 'ps'));
});

test('引数の誤りは 2 を返す', async () => {
  const err: string[] = [];
  const deps = {
    exec: () => ({ status: 0, stdout: '', stderr: '' }),
    cwd: '/x',
    stderr: (s: string) => err.push(s),
    stdout: () => {},
  };
  assert.equal(await run(['prepare', '5'], deps), 2);
  assert.equal(await run(['nuke', '1'], deps), 2);
  assert.equal(await run([], deps), 2);
});

test('renderEnv が slot 3 の値を全て出す', () => {
  const text = renderEnv(3, secrets);
  const map = Object.fromEntries(
    text
      .trim()
      .split('\n')
      .map((l: string) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
  );
  assert.equal(map.SLOT, '3');
  assert.equal(map.PORT, '3103');
  assert.equal(map.BETTER_AUTH_URL, 'http://localhost:3103');
  assert.equal(map.S3_BUCKET, 'insta-s3');
  assert.equal(map.S3_REGION, 'auto');
  assert.equal(map.S3_ENDPOINT, 'http://localhost:3910');
  // Media is served by Garage's web endpoint: its own origin, bucket as the host, no bucket segment.
  assert.equal(map.MEDIA_ORIGIN, 'http://insta-s3.web.localhost:3912');
  assert.equal(map.S3_PUBLIC_BASE_URL, 'http://insta-s3.web.localhost:3912');
  assert.equal(map.S3_ACCESS_KEY, secrets.accessKey);
  assert.equal(map.S3_SECRET_KEY, secrets.secretKey);
  assert.equal(map.AUTH_PEPPER, secrets.authPepper);
  assert.equal(map.BETTER_AUTH_SECRET, secrets.authSecret);
  assert.ok(!('DATABASE_URL' in map), 'D1 has no connection URL (ADR-0019)');
});

test('.env.example が renderEnv の変数名を全て含む', () => {
  const names = renderEnv(1, secrets)
    .trim()
    .split('\n')
    .map((l: string) => l.slice(0, l.indexOf('=')));
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8').split('\n');
  for (const name of names) {
    assert.ok(example.includes(`${name}=`), `${name}= (empty value) is missing from .env.example`);
  }
});

test('key create が既存で失敗したら key info を 1 回やり直す', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'slot-unit-'));
  let infoCalls = 0;
  const keyOut = 'Key ID:              GKtest\nSecret key:          sektest\n';
  const code = await run(['prepare', '1'], {
    exec: (cmd: string, args: string[]) => {
      if (cmd === 'docker' && args[0] === 'ps') return { status: 0, stdout: 'cid\n', stderr: '' };
      const g = args.slice(3).join(' ');
      if (g.startsWith('key info'))
        return infoCalls++ === 0
          ? { status: 1, stdout: '', stderr: 'not found' }
          : { status: 0, stdout: keyOut, stderr: '' };
      if (g.startsWith('key create')) return { status: 1, stdout: '', stderr: 'already exists' };
      return { status: 0, stdout: '', stderr: '' };
    },
    cwd: dir,
    putCors: async () => '',
    stderr: () => {},
    stdout: () => {},
  });
  rmSync(dir, { recursive: true, force: true });
  assert.equal(code, 0);
  assert.equal(infoCalls, 2);
});

test('結合テストは SLOT_INT=1 のときだけ流す', () => {
  assert.equal(slotIntEnabled({}), false);
  assert.equal(slotIntEnabled({ SLOT_INT: '0' }), false);
  assert.equal(slotIntEnabled({ SLOT_INT: '1' }), true);
});

test('corsXml がスロットのアプリの origin だけに PUT・GET・HEAD を許す', () => {
  const xml = corsXml(3);
  assert.match(xml, /<AllowedOrigin>http:\/\/localhost:3103<\/AllowedOrigin>/);
  assert.equal((xml.match(/<AllowedOrigin>/g) ?? []).length, 1);
  for (const m of ['PUT', 'GET', 'HEAD'])
    assert.match(xml, new RegExp(`<AllowedMethod>${m}</AllowedMethod>`));
  assert.doesNotMatch(xml, /DELETE|POST|\*<\/AllowedOrigin>/);
  assert.match(xml, /<AllowedHeader>content-type<\/AllowedHeader>/);
  assert.match(xml, /<AllowedHeader>content-length<\/AllowedHeader>/);
});

test('prepare が スロットのバケットのウェブ公開を許可する（reset も同じ手順を通る）', async () => {
  for (const command of ['prepare', 'prepare']) {
    const dir = mkdtempSync(join(tmpdir(), 'slot-unit-'));
    const garage: string[] = [];
    const code = await run([command, '2'], {
      exec: (cmd: string, args: string[]) => {
        if (cmd === 'docker' && args[0] === 'ps') return { status: 0, stdout: 'cid\n', stderr: '' };
        if (cmd === 'docker') garage.push(args.slice(3).join(' '));
        return { status: 0, stdout: 'Key ID:  GK\nSecret key:  sek\n', stderr: '' };
      },
      cwd: dir,
      putCors: async () => '',
      stderr: () => {},
      stdout: () => {},
    });
    rmSync(dir, { recursive: true, force: true });
    assert.equal(code, 0);
    assert.ok(
      garage.includes('bucket website --allow insta-s2'),
      `${command}: ${garage.join(' | ')}`,
    );
  }
});

// --- Stopping the slot's app server on drop / reset (#83) ---

function stackDeps(over: Record<string, unknown> = {}) {
  const log: string[] = [];
  const out: string[] = [];
  const err: string[] = [];
  const dir = mkdtempSync(join(tmpdir(), 'slot-unit-'));
  const deps = {
    exec: (cmd: string, args: string[]) => {
      if (cmd === 'docker' && args[0] === 'ps') return { status: 0, stdout: 'cid\n', stderr: '' };
      if (cmd === 'docker') log.push(`garage ${args.slice(3).join(' ')}`);
      return { status: 0, stdout: 'Key ID:  GK\nSecret key:  sek\n', stderr: '' };
    },
    cwd: dir,
    putCors: async () => '',
    emptyBucket: async () => {},
    sleep: async () => {},
    stdout: (s: string) => out.push(s),
    stderr: (s: string) => err.push(s),
    ...over,
  };
  return { deps, log, out, err, done: () => rmSync(dir, { recursive: true, force: true }) };
}

test('drop はスロットのポートで待ち受けるプロセスを子ごと止めてから消す', async () => {
  const order: string[] = [];
  const listening = new Set([111, 222]);
  const t = stackDeps({
    listPortPids: async (port: number) => {
      order.push(`list ${port}`);
      return [...listening];
    },
    killTree: (pid: number, signal: string) => {
      order.push(`${signal} ${pid}`);
      listening.delete(pid);
    },
  });
  t.deps.exec = ((orig) => (cmd: string, args: string[]) => {
    if (cmd === 'docker' && args[0] !== 'ps') order.push(`garage ${args.slice(3).join(' ')}`);
    return orig(cmd, args);
  })(t.deps.exec);
  const code = await run(['drop', '2'], t.deps);
  t.done();
  assert.equal(code, 0);
  assert.ok(order.includes('list 3102'));
  assert.ok(order.includes('SIGTERM 111') && order.includes('SIGTERM 222'));
  const lastKill = Math.max(...order.map((s, i) => (s.startsWith('SIG') ? i : -1)));
  const firstGarage = order.findIndex((s) => s.startsWith('garage'));
  assert.ok(lastKill < firstGarage, `stop before delete: ${order.join(' | ')}`);
  assert.ok(t.out.some((s) => s === 'slot 2 のポート 3102 のプロセスを 2 個止めました'));
});

test('reset もスロットのポートのプロセスを止める', async () => {
  const killed: string[] = [];
  const listening = new Set([7]);
  const t = stackDeps({
    listPortPids: async () => [...listening],
    killTree: (pid: number, signal: string) => {
      killed.push(`${signal} ${pid}`);
      listening.delete(pid);
    },
  });
  const code = await run(['reset', '2'], t.deps);
  t.done();
  assert.equal(code, 0);
  assert.deepEqual(killed, ['SIGTERM 7']);
  assert.ok(t.out.some((s) => s.includes('3102 のプロセスを 1 個止めました')));
});

test('prepare はプロセスに触れない', async () => {
  let listed = 0;
  const t = stackDeps({
    listPortPids: async () => {
      listed++;
      return [1];
    },
    killTree: () => assert.fail('prepare must not stop anything'),
  });
  const code = await run(['prepare', '2'], t.deps);
  t.done();
  assert.equal(code, 0);
  assert.equal(listed, 0);
});

test('ポートに誰もいなければ何も止めずに消す', async () => {
  const t = stackDeps({
    listPortPids: async () => [],
    killTree: () => assert.fail('nothing to stop'),
  });
  const code = await run(['drop', '3'], t.deps);
  t.done();
  assert.equal(code, 0);
  assert.ok(t.out.some((s) => s === 'slot 3 のポート 3103 のプロセスを 0 個止めました'));
  assert.ok(t.out.some((s) => s.includes('slot 3 を削除しました')));
});

test('TERM で止まらなければ KILL で止める', async () => {
  const signals: string[] = [];
  let alive = true;
  const t = stackDeps({
    listPortPids: async () => (alive ? [9] : []),
    killTree: (pid: number, signal: string) => {
      signals.push(signal);
      if (signal === 'SIGKILL') alive = false;
    },
  });
  const code = await run(['drop', '1'], t.deps);
  t.done();
  assert.equal(code, 0);
  assert.deepEqual(signals, ['SIGTERM', 'SIGKILL']);
});

test('止まらないプロセスがあれば消さずに 1 で終わる', async () => {
  const t = stackDeps({
    listPortPids: async () => [4242],
    killTree: () => {},
  });
  const code = await run(['drop', '1'], t.deps);
  const garageCalls = t.log.length;
  t.done();
  assert.equal(code, 1);
  assert.match(t.err.join('\n'), /4242/);
  assert.equal(garageCalls, 0, 'nothing is deleted');
});

test('範囲外のスロットではプロセスを探さない', async () => {
  const t = stackDeps({
    listPortPids: async () => assert.fail('must not look for processes'),
    killTree: () => assert.fail('must not stop anything'),
  });
  assert.equal(await run(['drop', '5'], t.deps), 2);
  assert.equal(await run(['drop', '-1'], t.deps), 2);
  t.done();
});

test('ポートの持ち主に加えて、同じポートで起動した親（wrangler・preview）も対象にする', async () => {
  const ps = [
    '  10     1 zsh',
    '  20    10 node cli/index.js preview --port 3102',
    '  30    20 node wrangler.js dev --port 3102',
    '  40    30 node wrangler-dist/cli.js dev --port 3102',
    '  50    40 workerd serve --socket-addr=entry=localhost:3102',
  ].join('\n');
  const exec = (cmd: string) =>
    cmd === 'lsof'
      ? { status: 0, stdout: '50\n', stderr: '' }
      : { status: 0, stdout: ps, stderr: '' };
  assert.deepEqual((await listPortPids(3102, exec)).sort(), [20, 30, 40, 50]);
});

const psOf = (rows: string[]) => (cmd: string) =>
  cmd === 'lsof'
    ? { status: 0, stdout: '50\n', stderr: '' }
    : { status: 0, stdout: rows.join('\n'), stderr: '' };

test('このプロセス自身とその親は、command にポートがあっても対象にしない', async () => {
  const rows = [
    '  10     1 bash -c pnpm start --port 3102 & node scripts/slot.mjs drop 2',
    '  20    10 node cli/index.js preview --port 3102',
    '  50    20 workerd serve --socket-addr=entry=localhost:3102',
    '  60    10 node scripts/slot.mjs drop 2',
  ];
  const got = await listPortPids(3102, psOf(rows), 60);
  assert.ok(!got.includes(10) && !got.includes(60), `self chain was targeted: ${got}`);
  assert.deepEqual(got.sort(), [20, 50]);
});

test('killTree は自分自身とその親には信号を送らない', () => {
  const run = (target: number, rows: string[]) => {
    const sent: number[] = [];
    killTree(target, 'SIGTERM', psOf(rows), 60, (pid: number) => {
      sent.push(pid);
      return true as const;
    });
    return sent;
  };
  const chain = ['  10     1 sh', '  20    10 node', '  60    20 node slot.mjs'];
  assert.deepEqual(run(10, chain), []);
  assert.deepEqual(run(20, ['  20    10 node', '  70    20 workerd']), [70, 20]);
});

test('command に localhost:ポート しか無い親は、ポートで起動した親とみなさない', async () => {
  const rows = [
    '  20     1 node tool.js --host localhost:3102',
    '  50    20 workerd serve --socket-addr=entry=localhost:3102',
  ];
  assert.deepEqual(await listPortPids(3102, psOf(rows), 999), [50]);
});

test('--port=ポート と PORT=ポート の親は対象にする', async () => {
  const rows = [
    '  10     1 node a.js --port=3102',
    '  20    10 env PORT=3102 node b.js',
    '  50    20 workerd serve',
  ];
  assert.deepEqual((await listPortPids(3102, psOf(rows), 999)).sort(), [10, 20, 50]);
});

test('lsof が PID 1 を返しても対象にしない', async () => {
  const exec = (cmd: string) =>
    cmd === 'lsof'
      ? { status: 0, stdout: '1\n400\n', stderr: '' }
      : { status: 0, stdout: '   1     0 launchd\n 400     1 workerd', stderr: '' };
  assert.deepEqual(await listPortPids(3102, exec, 999), [400]);
});

test('killTree は PID 1 には何も送らない', () => {
  const sent: number[] = [];
  killTree(1, 'SIGTERM', psOf(['   1     0 launchd', ' 400     1 workerd']), 999, (pid: number) => {
    sent.push(pid);
    return true as const;
  });
  assert.equal(sent.length, 0);
});

// --- emptyBucket: 32 parallel DELETEs with progress (#108) ---

const keysOf = (n: number) => Array.from({ length: n }, (_, i) => `k${i}`);

test('emptyBucket は 32 本まで並べて全ての key を 1 回ずつ消す', async () => {
  const seen = new Map<string, number>();
  let running = 0;
  let peak = 0;
  await emptyBucket(
    { bucket: 'insta-s2' },
    {
      list: async () => keysOf(10_000),
      del: async (_cfg: unknown, key: string) => {
        seen.set(key, (seen.get(key) ?? 0) + 1);
        peak = Math.max(peak, ++running);
        await new Promise((r) => setImmediate(r));
        running--;
      },
      out: () => {},
    },
  );
  assert.equal(seen.size, 10_000);
  assert.ok([...seen.values()].every((c) => c === 1));
  assert.equal(peak, 32);
});

test('emptyBucket は 1 万個ごとと最後に消した数を出す', async () => {
  const out: string[] = [];
  await emptyBucket(
    { bucket: 'insta-s2' },
    { list: async () => keysOf(25_000), del: async () => {}, out: (s: string) => out.push(s) },
  );
  assert.deepEqual(out, [
    'バケット insta-s2 のオブジェクトを 10000 / 25000 個消しました',
    'バケット insta-s2 のオブジェクトを 20000 / 25000 個消しました',
    'バケット insta-s2 のオブジェクトを 25000 / 25000 個消しました',
  ]);
});

test('emptyBucket は 空のときは空と出す', async () => {
  const out: string[] = [];
  await emptyBucket(
    { bucket: 'insta-s2' },
    { list: async () => [], del: async () => {}, out: (s: string) => out.push(s) },
  );
  assert.deepEqual(out, ['バケット insta-s2 は空です']);
});

test('emptyBucket は 失敗したら新しい delete を始めず、動いている分を待って最初のエラーで終わる', async () => {
  let started = 0;
  let running = 0;
  await assert.rejects(
    emptyBucket(
      { bucket: 'insta-s2' },
      {
        list: async () => keysOf(1000),
        del: async (_c: unknown, key: string) => {
          started++;
          running++;
          await new Promise((r) => setImmediate(r));
          running--;
          if (key === 'k2') throw new Error('S3 DELETE /insta-s2/k2 -> 500');
        },
        out: () => {},
        concurrency: 4,
      },
    ),
    /k2 -> 500/,
  );
  assert.equal(running, 0);
  assert.ok(started < 20, `started ${started}`);
});

test('バケットを空にする途中の失敗で reset は 1 を返し .dev.vars を書かない', async () => {
  let calls = 0;
  const t = stackDeps({
    emptyBucket: (cfg: unknown) =>
      emptyBucket(cfg as { bucket: string }, {
        list: async () => ['k1', 'k2', 'k3', 'k4'],
        del: async (_c: unknown, key: string) => {
          calls++;
          if (key === 'k3') throw new Error('S3 DELETE /insta-s2/k3 -> 500');
        },
        out: () => {},
      }),
    listPortPids: async () => [],
  });
  const code = await run(['reset', '2'], t.deps);
  const wrote = existsSync(join(t.deps.cwd, '.dev.vars'));
  t.done();
  assert.equal(code, 1);
  assert.ok(calls >= 3);
  assert.ok(
    t.err.some((s) => s.includes('slot 2 の reset に失敗しました: S3 DELETE /insta-s2/k3 -> 500')),
  );
  assert.equal(wrote, false);
});
