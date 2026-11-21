import { asc, count, eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { headObject, loadStorageEnv, putObject, putPhoto } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { newId } from '../../../shared/db/id';
import { media, posts, rateLimits, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import { consume } from '../../../shared/security/rate-limit';
import type { StorageEnv } from '../../../shared/storage';
import { createPost } from './create-post';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const NOT_UPLOADED = '写真のアップロードが完了していません';
// A fixed time: the rate limit uses a fixed window, so a real clock could cross its edge mid-test.
const NOW = 1_700_000_000_000;

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;

/** A key under the user's own area whose four files are in storage. */
async function uploaded(userId: string): Promise<string> {
  const key = `media/${userId}/${newId()}`;
  await putPhoto(storage, key);
  return key;
}
const photo = (key: string, over: Record<string, unknown> = {}) => ({
  key,
  width: 480,
  height: 600,
  altText: '',
  thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
  ...over,
});
const request = (media: unknown[], over: Record<string, unknown> = {}) => ({
  caption: '',
  media,
  clientRequestId: crypto.randomUUID(),
  ...over,
});
const call = (s: Session, input: unknown, now = NOW) =>
  createPost(input, { env: s.env, headers: s.headers, now });

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}
const postCount = async () => (await t.db.select({ n: count() }).from(posts))[0]!.n;
const mediaCount = async () => (await t.db.select({ n: count() }).from(media))[0]!.n;

describe('createPost', () => {
  it('同じ clientRequestId の 2 回目は同じ postId を返し 行を増やさない', async () => {
    const s = await signedIn();
    const input = request([photo(await uploaded(s.user.id))]);

    const first = await call(s, input);
    const second = await call(s, input);

    expect(second.postId).toBe(first.postId);
    expect(await postCount()).toBe(1);
    expect(await mediaCount()).toBe(1);
    // The second call is not counted against the 30 an hour.
    const [limit] = await t.db.select().from(rateLimits);
    expect(limit?.count).toBe(1);
  });

  it('同じ clientRequestId の同時の 2 回目も同じ postId を返し 行は 1 件になる', async () => {
    const s = await signedIn();
    const input = request([photo(await uploaded(s.user.id))]);

    const [a, b] = await Promise.all([call(s, input), call(s, input)]);

    expect(b.postId).toBe(a.postId);
    expect(await postCount()).toBe(1);
    expect(await mediaCount()).toBe(1);
    // A double click may count twice (both calls pass the earlier-post check before either inserts);
    // never more than that, and never a second post.
    const [limit] = await t.db.select().from(rateLimits);
    expect(limit?.count).toBeGreaterThanOrEqual(1);
    expect(limit?.count).toBeLessThanOrEqual(2);
  });

  it('同じ key を別の clientRequestId で同時に使うと 投稿は 1 件だけで もう一方は VALIDATION になる', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);

    const results = await Promise.allSettled([
      call(s, request([photo(key)])),
      call(s, request([photo(key)])),
    ]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const failed = results.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    expect(failed.reason).toBeInstanceOf(AppError);
    expect((failed.reason as AppError).code).toBe('VALIDATION');
    expect((failed.reason as AppError).message).toBe(NOT_UPLOADED);
    expect(await postCount()).toBe(1);
    expect(await mediaCount()).toBe(1);
  });

  it('別の利用者の同じ clientRequestId は別の投稿になる', async () => {
    const a = await signedIn();
    const b = await signedIn();
    const clientRequestId = crypto.randomUUID();
    const pa = await call(a, request([photo(await uploaded(a.user.id))], { clientRequestId }));
    const pb = await call(b, request([photo(await uploaded(b.user.id))], { clientRequestId }));
    expect(pb.postId).not.toBe(pa.postId);
    expect(await postCount()).toBe(2);
  });

  it('未ログインのとき UNAUTHENTICATED を返す', async () => {
    const s = await signedIn();
    const input = request([photo(await uploaded(s.user.id))]);
    const err = await rejection(() =>
      createPost(input, { env: s.env, headers: new Headers(), now: NOW }),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
    expect(err.message).toBe('ログインしてください');
    expect(await postCount()).toBe(0);
  });

  it('1 時間に 31 件目の投稿を RATE_LIMITED で拒む', async () => {
    const a = await signedIn();
    const b = await signedIn();
    // 29 posts are already counted in this hour; the 30th passes and the 31st does not.
    await consume(`post:user:${a.user.id}`, 30, 3600, 29, { db: t.db, now: NOW });

    await call(a, request([photo(await uploaded(a.user.id))]));
    const err = await rejection(async () =>
      call(a, request([photo(await uploaded(a.user.id))], { caption: 'dropped' })),
    );
    expect(err.code).toBe('RATE_LIMITED');
    expect(err.message).toBe('操作が多すぎます。しばらくしてからもう一度お試しください');
    expect(await postCount()).toBe(1);

    // Another user is not affected, and the next hour starts again.
    await call(b, request([photo(await uploaded(b.user.id))]));
    await call(a, request([photo(await uploaded(a.user.id))]), NOW + 3_600_000);
    expect(await postCount()).toBe(3);
  });

  it('他人の key と存在しない key と重複した key を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const other = await createUser(t.db);
    const mine = await uploaded(s.user.id);
    const theirs = await uploaded(other.id);
    const bad: [string, unknown[]][] = [
      ['他人の領域', [photo(theirs)]],
      ['ストレージに無い', [photo(`media/${s.user.id}/${newId()}`)]],
      ['重複', [photo(mine), photo(mine)]],
      ['形が違う', [photo(`media/${s.user.id}/../${other.id}/x`)]],
      ['領域の外', [photo(`avatars/${s.user.id}/${newId()}`)]],
    ];
    for (const [name, list] of bad) {
      const err = await rejection(() => call(s, request(list)));
      expect(err.code, name).toBe('VALIDATION');
      expect(err.message, name).toBe(NOT_UPLOADED);
    }
    expect(await postCount()).toBe(0);
    expect(await mediaCount()).toBe(0);
    // Nothing was deleted by the rejections.
    expect(await headObject(storage, `${theirs}/orig.webp`)).not.toBeNull();
  });

  it('他の投稿やプロフィールの写真が使っている key を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);
    await call(s, request([photo(key)]));
    const again = await rejection(() => call(s, request([photo(key)])));
    expect(again.code).toBe('VALIDATION');
    expect(again.message).toBe(NOT_UPLOADED);

    const avatar = await uploaded(s.user.id);
    await t.db.update(users).set({ avatarKey: avatar }).where(eq(users.id, s.user.id));
    const used = await rejection(() => call(s, request([photo(avatar)])));
    expect(used.code).toBe('VALIDATION');
    expect(await postCount()).toBe(1);
  });

  it('4 つのファイルが揃わない key と WebP でない key と大きすぎる key を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const partial = `media/${s.user.id}/${newId()}`;
    await putObject(storage, `${partial}/orig.webp`, new Uint8Array(4));
    const notWebp = `media/${s.user.id}/${newId()}`;
    await putPhoto(storage, notWebp);
    await putObject(storage, `${notWebp}/w640.webp`, new Uint8Array(4), 'text/html');
    const huge = `media/${s.user.id}/${newId()}`;
    await putPhoto(storage, huge);
    await putObject(storage, `${huge}/orig.webp`, new Uint8Array(10_485_761));

    for (const key of [partial, notWebp, huge]) {
      const err = await rejection(() => call(s, request([photo(key)])));
      expect(err.code, key).toBe('VALIDATION');
      expect(err.message, key).toBe(NOT_UPLOADED);
    }
    expect(await postCount()).toBe(0);
    // The files that cannot be shown are removed; the incomplete set is left for the sweep job.
    expect(await headObject(storage, `${notWebp}/w640.webp`)).toBeNull();
    expect(await headObject(storage, `${huge}/orig.webp`)).toBeNull();
  });

  it('キャプションの 2201 字と代替テキストの 501 字と写真の 0 枚と 11 枚を VALIDATION で拒む', async () => {
    const s = await signedIn();
    const key = await uploaded(s.user.id);
    const keys = await Promise.all(Array.from({ length: 11 }, () => uploaded(s.user.id)));
    const cases: [string, unknown][] = [
      ['caption', request([photo(key)], { caption: 'あ'.repeat(2201) })],
      ['alt', request([photo(key, { altText: 'あ'.repeat(501) })])],
      ['0 枚', request([])],
      ['11 枚', request(keys.map((k) => photo(k)))],
      ['clientRequestId', request([photo(key)], { clientRequestId: 'x' })],
    ];
    for (const [name, input] of cases) {
      const err = await rejection(() => call(s, input));
      expect(err.code, name).toBe('VALIDATION');
    }
    const caption = await rejection(() => call(s, cases[0]![1]));
    expect(caption.fieldErrors?.caption).toEqual(['キャプションは 2,200 字までです']);
    expect(await postCount()).toBe(0);
  });

  it('2,200 字のキャプションと 10 枚の写真を 並びのまま保存する', async () => {
    const s = await signedIn();
    const keys = await Promise.all(Array.from({ length: 10 }, () => uploaded(s.user.id)));
    const caption = '  😀'.repeat(733).slice(0, -2) + '\n ';
    const { postId } = await call(
      s,
      request(
        keys.map((k, i) => photo(k, { altText: `写真 ${i + 1}`, width: 100 + i })),
        { caption },
      ),
    );

    const [row] = await t.db.select().from(posts).where(eq(posts.id, postId));
    expect(row?.authorId).toBe(s.user.id);
    expect(row?.caption).toBe(caption);
    expect(row?.createdAt.getTime()).toBe(NOW);
    const rows = await t.db
      .select()
      .from(media)
      .where(eq(media.postId, postId))
      .orderBy(asc(media.position));
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(rows.map((r) => r.storageKey)).toEqual(keys);
    expect(rows.map((r) => r.altText)).toEqual(keys.map((_, i) => `写真 ${i + 1}`));
    expect(rows.map((r) => r.width)).toEqual(keys.map((_, i) => 100 + i));
    expect(rows.every((r) => r.type === 'image' && r.height === 600)).toBe(true);
  });
});
