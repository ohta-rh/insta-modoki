import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'vitest';
import { corsXml, renderEnv, run, slotIntEnabled, slotNames } from './slot.mjs';

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
  assert.equal(map.MEDIA_ORIGIN, 'http://localhost:3910');
  assert.equal(map.S3_PUBLIC_BASE_URL, 'http://localhost:3910/insta-s3');
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
