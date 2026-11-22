import { count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { buildMp4 } from '../../../../tests/helpers/mp4';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv, putObject, putPhoto } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { newId } from '../../../shared/db/id';
import { rateLimits } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { createStory } from './create-story';
import { stories } from '../db/schema';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

// A fixed time: the rate limit uses a fixed window, so a real clock could cross its edge mid-test.
const NOW = 1_700_000_000_000;
const DAY = 86_400_000;
const NOT_UPLOADED = 'アップロードが完了していません';

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;
const call = (s: Session, input: unknown, now = NOW) =>
  createStory(input, { env: s.env, headers: s.headers, now });

/** A video key whose `video.mp4` is in storage with the given length. */
async function uploadedVideo(userId: string, durationMs = 5000, over: object = {}) {
  const key = `stories/${userId}/${newId()}`;
  const bytes = buildMp4({
    timescale: 1000,
    duration: durationMs,
    width: 320,
    height: 568,
    ...over,
  });
  await putObject(storage, `${key}/video.mp4`, bytes, 'video/mp4');
  return key;
}
async function uploadedPhoto(userId: string) {
  const key = `stories/${userId}/${newId()}`;
  await putPhoto(storage, key);
  return key;
}
const videoInput = (key: string, over: object = {}) => ({
  key,
  type: 'video',
  altText: '',
  ...over,
});
const photoInput = (key: string, over: object = {}) => ({
  key,
  type: 'image',
  width: 480,
  height: 600,
  altText: '',
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
const rows = () => t.db.select().from(stories);
const storyCount = async () => (await t.db.select({ n: count() }).from(stories))[0]!.n;

describe('createStory', () => {
  it('保存した動画の長さが 15,000 ms のとき作成し、15,001 ms のとき VALIDATION を返す', async () => {
    const s = await signedIn();
    const ok = await call(s, videoInput(await uploadedVideo(s.user.id, 15_000)));
    const [row] = await rows();
    expect(row).toMatchObject({
      id: ok.storyId,
      authorId: s.user.id,
      type: 'video',
      durationMs: 15_000,
      width: 320,
      height: 568,
    });

    const tooLong = await uploadedVideo(s.user.id, 15_001);
    const err = await rejection(() => call(s, videoInput(tooLong)));
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('動画は 15 秒までです');
    expect(err.fieldErrors?.media).toEqual(['動画は 15 秒までです']);
    expect(await storyCount()).toBe(1);
  });

  it('クライアントが申告した長さと大きさは使わない', async () => {
    const s = await signedIn();
    const key = await uploadedVideo(s.user.id, 5000);
    await call(s, videoInput(key, { durationMs: 1, width: 5, height: 5 }));
    expect((await rows())[0]).toMatchObject({ durationMs: 5000, width: 320, height: 568 });
  });

  it('読めない動画と 大きさの範囲を外れた動画を VIDEO_UNREADABLE で拒む', async () => {
    const s = await signedIn();
    const junk = `stories/${s.user.id}/${newId()}`;
    await putObject(storage, `${junk}/video.mp4`, new Uint8Array(64), 'video/mp4');
    for (const key of [
      junk,
      await uploadedVideo(s.user.id, 5000, { width: 10_001 }),
      await uploadedVideo(s.user.id, 0),
    ]) {
      const err = await rejection(() => call(s, videoInput(key)));
      expect(err.code).toBe('VALIDATION');
      expect(err.message).toBe('動画を読み込めませんでした');
    }
    expect(await storyCount()).toBe(0);
  });

  it('写真は申告した大きさと代替テキストで作る', async () => {
    const s = await signedIn();
    const key = await uploadedPhoto(s.user.id);
    const { storyId } = await call(s, photoInput(key, { altText: '  夕焼け ' }));
    expect((await rows())[0]).toMatchObject({
      id: storyId,
      type: 'image',
      storageKey: key,
      width: 480,
      height: 600,
      durationMs: null,
      altText: '夕焼け',
    });
  });

  it('expires_at は created_at のちょうど 24 時間後になる', async () => {
    const s = await signedIn();
    await call(s, photoInput(await uploadedPhoto(s.user.id)));
    const [row] = await rows();
    expect(row!.createdAt.getTime()).toBe(NOW);
    expect(row!.expiresAt.getTime()).toBe(NOW + DAY);
  });

  it('他人の key を FORBIDDEN で拒む', async () => {
    const s = await signedIn();
    const other = await createUser(t.db);
    const key = await uploadedVideo(other.id);
    const err = await rejection(() => call(s, videoInput(key)));
    expect(err.code).toBe('FORBIDDEN');
    expect(err.message).toBe('この操作はできません');
    expect(await storyCount()).toBe(0);
    // It is refused before it is counted.
    expect(await t.db.select().from(rateLimits)).toEqual([]);
  });

  it('形の違う key と未アップロードの key を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const uuid = newId();
    const bad = [
      `media/${s.user.id}/${uuid}`,
      `stories/${s.user.id}/not-a-uuid`,
      `stories/${s.user.id}/${uuid}/video.mp4`,
      `stories/${s.user.id}/${uuid}/../x`,
      `stories/${s.user.id}`,
      `stories//${uuid}`,
      '',
      // Not uploaded yet: the shape is right but no file is there.
      `stories/${s.user.id}/${newId()}`,
    ];
    for (const key of bad) {
      for (const input of [videoInput(key), photoInput(key)]) {
        const err = await rejection(() => call(s, input));
        expect(err.code, key).toBe('VALIDATION');
      }
    }
    expect((await rejection(() => call(s, videoInput(bad[0]!)))).message).toBe(NOT_UPLOADED);
    expect(await storyCount()).toBe(0);
  });

  it('保存された形式と大きさが合わないものを未アップロードとして拒む', async () => {
    const s = await signedIn();
    // A photo with one of the four files missing.
    const partial = `stories/${s.user.id}/${newId()}`;
    await putObject(storage, `${partial}/orig.webp`, new Uint8Array(4));
    // A photo whose file is not WebP.
    const wrongType = `stories/${s.user.id}/${newId()}`;
    for (const n of ['orig', 'w320', 'w640', 'w1080']) {
      await putObject(storage, `${wrongType}/${n}.webp`, new Uint8Array(4), 'image/png');
    }
    // A video stored as another type.
    const notMp4 = `stories/${s.user.id}/${newId()}`;
    await putObject(
      storage,
      `${notMp4}/video.mp4`,
      buildMp4({ timescale: 1, duration: 1, width: 1, height: 1 }),
      'video/webm',
    );
    // The type says video but only a photo is there, and the reverse.
    const photoAsVideo = await uploadedPhoto(s.user.id);
    const videoAsPhoto = await uploadedVideo(s.user.id);

    for (const input of [
      photoInput(partial),
      photoInput(wrongType),
      videoInput(notMp4),
      videoInput(photoAsVideo),
      photoInput(videoAsPhoto),
    ]) {
      const err = await rejection(() => call(s, input));
      expect(err.code).toBe('VALIDATION');
      expect(err.message).toBe(NOT_UPLOADED);
    }
    expect(await storyCount()).toBe(0);
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const err = await rejection(() =>
      createStory(videoInput('stories/x/y'), { env, headers: new Headers(), now: NOW }),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('形の誤りの入力を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const key = await uploadedPhoto(s.user.id);
    for (const input of [
      null,
      { key, type: 'image', altText: '' },
      photoInput(key, { altText: 'a'.repeat(501) }),
      photoInput(key, { type: 'gif' }),
    ]) {
      expect((await rejection(() => call(s, input))).code).toBe('VALIDATION');
    }
    expect(await storyCount()).toBe(0);
  });

  it('同じ key の再送は同じ storyId を返し、回数を数えない', async () => {
    const s = await signedIn();
    const input = videoInput(await uploadedVideo(s.user.id));
    const first = await call(s, input);
    const second = await call(s, input);
    expect(second.storyId).toBe(first.storyId);
    expect(await storyCount()).toBe(1);
    const limits = await t.db.select().from(rateLimits);
    expect(limits.map((l) => [l.key, l.count])).toEqual([[`story:user:${s.user.id}`, 1]]);
  });

  it('同じ key の同時の再送も同じ storyId を返し 行は 1 件になる', async () => {
    const s = await signedIn();
    const input = videoInput(await uploadedVideo(s.user.id));
    const [a, b] = await Promise.all([call(s, input), call(s, input)]);
    expect(b.storyId).toBe(a.storyId);
    expect(await storyCount()).toBe(1);
  });

  // 31 uploads + 33 createStory calls run one after another (measured 5.0 s on a loaded host); the 5 s default is too tight.
  it('1 時間 30 件目まで成功し、31 件目は RATE_LIMITED を返す', async () => {
    const s = await signedIn();
    const keys = await Promise.all(Array.from({ length: 31 }, () => uploadedVideo(s.user.id)));
    for (const key of keys.slice(0, 30)) await call(s, videoInput(key));
    expect(await storyCount()).toBe(30);
    const err = await rejection(() => call(s, videoInput(keys[30]!)));
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.retryAfterSec).toBeGreaterThanOrEqual(1);
    expect(await storyCount()).toBe(30);
    // The next hour starts a new window.
    await call(s, videoInput(keys[30]!), NOW + 3_600_000);
    expect(await storyCount()).toBe(31);
    // Another user is not affected.
    const other = await signedIn();
    await call(other, videoInput(await uploadedVideo(other.user.id)));
    expect(
      (await t.db.select().from(stories).where(eq(stories.authorId, other.user.id))).length,
    ).toBe(1);
  }, 60_000);
});
