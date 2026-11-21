import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { requestUploadUrls } from './request-upload-urls';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const file = (over: Record<string, unknown> = {}) => ({
  contentType: 'image/jpeg',
  size: 1000,
  width: 800,
  height: 600,
  variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
  ...over,
});
const files = (n: number) => Array.from({ length: n }, () => file());

async function signedIn() {
  const e = env();
  const user = await createUser(t.db);
  return { e, user, headers: await sessionHeadersFor(t.db, e, user) };
}

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

describe('requestUploadUrls', () => {
  it('未ログインのとき UNAUTHENTICATED を返す', async () => {
    const e = env();
    for (const input of [{ files: files(1) }, { files: [] }]) {
      const err = await rejection(() => requestUploadUrls(input, { env: e, headers: new Headers() }));
      expect(err.code).toBe('UNAUTHENTICATED');
      expect(err.message).toBe('ログインしてください');
    }
  });

  it('枚数と大きさと画素数の境界を受け付け 1 つ外を拒む', async () => {
    const { e, headers } = await signedIn();
    const run = (list: unknown[]) => () =>
      requestUploadUrls({ files: list }, { env: e, headers, now: 1_000_000 });
    const codeOf = async (list: unknown[]) => (await rejection(run(list))).code;

    expect((await run(files(1))()).uploads).toHaveLength(1);
    expect((await run(files(10))()).uploads).toHaveLength(10);
    expect((await run([file({ size: 10_485_760 })])()).uploads).toHaveLength(1);
    expect((await run([file({ width: 2048, height: 2048 })])()).uploads).toHaveLength(1);

    expect(await codeOf([])).toBe('VALIDATION');
    expect(await codeOf(files(11))).toBe('VALIDATION');
    expect(await codeOf([file({ width: 2049 })])).toBe('VALIDATION');
    expect(await codeOf([file({ height: 0 })])).toBe('VALIDATION');
    expect(await codeOf([file({ contentType: 'image/gif' })])).toBe('VALIDATION');
    const big = await rejection(run([file({ size: 10_485_761 })]));
    expect(big.code).toBe('PAYLOAD_TOO_LARGE');
    expect(big.message).toBe('ファイルが大きすぎます（1 枚 10MB まで）');
    expect(
      await codeOf([file({ variantSizes: { orig: 10_485_761, w320: 1, w640: 1, w1080: 1 } })]),
    ).toBe('PAYLOAD_TOO_LARGE');
  });

  it('1 時間に 300 枚を超える発行を RATE_LIMITED で拒む', async () => {
    const a = await signedIn();
    const b = await signedIn();
    const now = 1_700_000_000_000;
    for (let i = 0; i < 30; i += 1) {
      await requestUploadUrls({ files: files(10) }, { env: a.e, headers: a.headers, now });
    }
    const err = await rejection(() =>
      requestUploadUrls({ files: files(1) }, { env: a.e, headers: a.headers, now }),
    );
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toBe('操作が多すぎます。しばらくしてからもう一度お試しください');
    const other = await requestUploadUrls({ files: files(1) }, { env: b.e, headers: b.headers, now });
    expect(other.uploads).toHaveLength(1);
  });

  it('発行される key は呼んだ利用者の領域の下に限られる', async () => {
    const { e, user, headers } = await signedIn();
    const input = { files: [{ ...file(), key: 'media/someone-else/x' }, file()] };
    const { uploads } = await requestUploadUrls(input, { env: e, headers });
    const keys = new Set<string>();
    for (const u of uploads) {
      expect(u.key).toMatch(
        new RegExp(`^media/${user.id}/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$`),
      );
      keys.add(u.key);
      for (const name of ['orig', 'w320', 'w640', 'w1080'] as const) {
        expect(u.putUrls[name]).toContain(`/${u.key}/${name}.webp?`);
      }
    }
    expect(keys.size).toBe(2);
  });

  it('発行された URL へ 宣言どおりの形式と大きさで PUT できる', async () => {
    const { e, headers } = await signedIn();
    const { uploads } = await requestUploadUrls({ files: [file()] }, { env: e, headers });
    const u = uploads[0]!;
    const sizes = { orig: 40, w320: 10, w640: 20, w1080: 30 };
    for (const name of ['orig', 'w320', 'w640', 'w1080'] as const) {
      const res = await fetch(u.putUrls[name], {
        method: 'PUT',
        body: new Uint8Array(sizes[name]),
        headers: { 'Content-Type': 'image/webp' },
      });
      expect(res.status, name).toBe(200);
      expect(await headObject(storage, `${u.key}/${name}.webp`)).toEqual({
        size: sizes[name],
        contentType: 'image/webp',
      });
    }
    const wrong = await fetch(u.putUrls.orig, {
      method: 'PUT',
      body: new Uint8Array(sizes.w320),
      headers: { 'Content-Type': 'image/webp' },
    });
    expect(wrong.status).toBe(403);
  });
});
