import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import type { StorageEnv } from '../../../shared/storage';
import { requestStoryUpload } from './request-story-upload';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const NOW = 1_700_000_000_000;
const KEY = /^stories\/([^/]+)\/[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;
const call = (s: Session, input: unknown) =>
  requestStoryUpload(input, { env: s.env, headers: s.headers, now: NOW });

const photo = (over: Record<string, unknown> = {}) => ({
  kind: 'image',
  files: [
    {
      contentType: 'image/jpeg',
      size: 1000,
      width: 800,
      height: 600,
      variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
      ...over,
    },
  ],
});
const video = (over: Record<string, unknown> = {}) => ({
  kind: 'video',
  contentType: 'video/mp4',
  size: 1000,
  durationMs: 5000,
  ...over,
});

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

describe('requestStoryUpload', () => {
  it('画像が 10,485,760 バイトのとき URL を返し、10,485,761 バイトのとき PAYLOAD_TOO_LARGE を返す', async () => {
    const s = await signedIn();
    const ok = await call(s, photo({ size: 10_485_760 }));
    expect(ok.key).toMatch(KEY);
    expect(ok.key.split('/')[1]).toBe(s.user.id);
    const urls = (ok as { putUrls: Record<string, string> }).putUrls;
    expect(Object.keys(urls).sort()).toEqual(['orig', 'w1080', 'w320', 'w640']);
    for (const [name, url] of Object.entries(urls)) {
      expect(url).toContain(`/${ok.key}/${name}.webp?`);
      expect(new URL(url).searchParams.get('X-Amz-Expires')).toBe('300');
    }

    const err = await rejection(() => call(s, photo({ size: 10_485_761 })));
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    expect(err.message).toBe('ファイルが大きすぎます（1 枚 10MB まで）');
  });

  it('動画が 31,457,280 バイトのとき通り、31,457,281 バイトのとき PAYLOAD_TOO_LARGE を返す', async () => {
    const s = await signedIn();
    const ok = await call(s, video({ size: 31_457_280 }));
    expect(ok.key).toMatch(KEY);
    const urls = (ok as { putUrls: Record<string, string> }).putUrls;
    expect(Object.keys(urls)).toEqual(['video']);
    expect(urls.video).toContain(`/${ok.key}/video.mp4?`);
    expect(new URL(urls.video!).searchParams.get('X-Amz-Expires')).toBe('300');

    const err = await rejection(() => call(s, video({ size: 31_457_281 })));
    expect(err.code).toBe('PAYLOAD_TOO_LARGE');
    expect(err.message).toBe('ファイルが大きすぎます（動画は 30MB まで）');
  });

  it('15,001 ms と受付外の形式を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const long = await rejection(() => call(s, video({ durationMs: 15_001 })));
    expect(long.code).toBe('VALIDATION');
    expect(long.fieldErrors?.media).toEqual(['動画は 15 秒までです']);
    expect((await call(s, video({ durationMs: 15_000 }))).key).toMatch(KEY);
    for (const contentType of ['image/gif', 'video/quicktime']) {
      expect((await rejection(() => call(s, video({ contentType })))).code).toBe('VALIDATION');
    }
    expect((await rejection(() => call(s, photo({ contentType: 'image/gif' })))).code).toBe(
      'VALIDATION',
    );
    expect((await rejection(() => call(s, { kind: 'image', files: [] }))).code).toBe('VALIDATION');
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    for (const input of [photo(), video()]) {
      const err = await rejection(() =>
        requestStoryUpload(input, { env, headers: new Headers(), now: NOW }),
      );
      expect(err.code).toBe('UNAUTHENTICATED');
    }
  });

  it('アップロードの枠を写真の投稿と共有する', async () => {
    const s = await signedIn();
    await consume(`upload:user:${s.user.id}`, 300, 3600, 300, { db: t.db, now: NOW });
    for (const input of [photo(), video()]) {
      const err = await rejection(() => call(s, input));
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.retryAfterSec).toBeGreaterThanOrEqual(1);
    }
    // Another user is not affected.
    expect((await call(await signedIn(), video())).key).toMatch(KEY);
  });

  it('発行される key は呼んだ利用者の領域に限られ 入力の key は読まない', async () => {
    const s = await signedIn();
    const input = { ...video(), key: 'stories/someone-else/x' };
    const { key } = await call(s, input);
    expect(key.startsWith(`stories/${s.user.id}/`)).toBe(true);
    expect((await call(s, video())).key).not.toBe(key);
  });

  it('発行された URL へ 宣言どおりの形式と大きさで PUT できる', async () => {
    const s = await signedIn();
    // The real clock: the storage refuses a URL signed with a date far from now.
    const { key, putUrls } = (await requestStoryUpload(video({ size: 20 }), {
      env: s.env,
      headers: s.headers,
    })) as unknown as {
      key: string;
      putUrls: { video: string };
    };
    const put = (body: Uint8Array<ArrayBuffer>, type = 'video/mp4') =>
      fetch(putUrls.video, { method: 'PUT', body, headers: { 'Content-Type': type } });
    // Another size or type than the one signed is refused and nothing is stored.
    expect((await put(new Uint8Array(21))).status).toBe(403);
    expect((await put(new Uint8Array(19))).status).toBe(403);
    expect((await put(new Uint8Array(20), 'video/webm')).status).toBe(403);
    expect(await headObject(storage, `${key}/video.mp4`)).toBeNull();
    expect((await put(new Uint8Array(20))).status).toBe(200);
    expect(await headObject(storage, `${key}/video.mp4`)).toEqual({
      size: 20,
      contentType: 'video/mp4',
    });
  });
});
