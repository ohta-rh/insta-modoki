import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { follows, posts } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { exploreQuery, listExplorePosts } from './list-explore-posts';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const T = Date.UTC(2026, 10, 22, 12);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

async function setup() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const viewer = await createUser(t.db);
  const headers = await sessionHeadersFor(t.db, env, viewer);
  const author = await createUser(t.db);
  return { env, viewer, headers, author };
}

/** A post by `authorId` made at `createdAt` (epoch ms) that has `likes` likes. */
async function liked(authorId: string, likes: number, createdAt: number, mediaCount = 1) {
  const post = await createPost(t.db, authorId, { createdAt: new Date(createdAt), mediaCount });
  await t.db.update(posts).set({ likeCount: likes }).where(eq(posts.id, post.id));
  return post;
}

const follow = (followerId: string, followeeId: string) =>
  t.db.insert(follows).values({ followerId, followeeId, createdAt: new Date(T) });

const idsOf = (page: { items: { id: string }[] }) => page.items.map((i) => i.id);

async function rejection(run: () => Promise<unknown>): Promise<AppError> {
  try {
    await run();
  } catch (e) {
    if (e instanceof AppError) return e;
    throw e;
  }
  throw new Error('AppError にならなかった');
}

describe('listExplorePosts', () => {
  it('7 日前ちょうどは含み、7 日と 1 ミリ秒前は含まず、いいね数の多い順に並べる', async () => {
    const s = await setup();
    const p1 = await liked(s.author.id, 5, T - DAY);
    const p2 = await liked(s.author.id, 9, T - 6 * DAY - 23 * HOUR);
    const p3 = await liked(s.author.id, 100, T - 7 * DAY - 1);
    const p4 = await liked(s.author.id, 3, T - 7 * DAY);
    const p5 = await liked(s.author.id, 50, T + 1);
    const page = await listExplorePosts({}, { ...s, now: T });
    expect(idsOf(page)).toEqual([p2.id, p1.id, p4.id]);
    expect(idsOf(page)).not.toContain(p3.id);
    expect(idsOf(page)).not.toContain(p5.id);
  });

  it('いいね数が同じなら新しい順、同時刻は id の降順に並べる', async () => {
    const s = await setup();
    const newer = await liked(s.author.id, 4, T - HOUR);
    const a = await liked(s.author.id, 4, T - 2 * HOUR);
    const b = await liked(s.author.id, 4, T - 2 * HOUR);
    const [hi, lo] = [a.id, b.id].sort().reverse() as [string, string];
    const page = await listExplorePosts({}, { ...s, now: T });
    expect(idsOf(page)).toEqual([newer.id, hi, lo]);
  });

  it('自分とフォロー中の人の投稿を除く', async () => {
    const s = await setup();
    const followed = await createUser(t.db);
    const stranger = s.author;
    await follow(s.viewer.id, followed.id);
    await follow(stranger.id, s.viewer.id);
    await liked(s.viewer.id, 1, T - HOUR);
    await liked(followed.id, 1, T - HOUR);
    const theirs = await liked(stranger.id, 1, T - HOUR);
    const page = await listExplorePosts({}, { ...s, now: T });
    expect(idsOf(page)).toEqual([theirs.id]);

    // Another viewer's own follows decide what is left out for them.
    const other = await createUser(t.db);
    await follow(other.id, stranger.id);
    const otherHeaders = await sessionHeadersFor(t.db, s.env, other);
    const mine = await liked(other.id, 1, T - 2 * HOUR);
    const seen = await listExplorePosts({}, { env: s.env, headers: otherHeaders, now: T });
    expect(idsOf(seen)).not.toContain(theirs.id);
    expect(idsOf(seen)).not.toContain(mine.id);
    expect(seen.items).toHaveLength(2);
  });

  it('24 件ずつ重複なく返し、24 件ちょうどは 1 ページで終わる', async () => {
    const s = await setup();
    const made = [];
    for (let i = 0; i < 25; i++) made.push(await liked(s.author.id, i % 3, T - (i + 1) * MIN));
    const expected = made
      .map((p, i) => ({ id: p.id, likes: i % 3, at: T - (i + 1) * MIN }))
      .sort((x, y) => y.likes - x.likes || y.at - x.at)
      .map((x) => x.id);

    const first = await listExplorePosts({}, { ...s, now: T });
    expect(idsOf(first)).toEqual(expected.slice(0, 24));
    expect(first.nextCursor).not.toBeNull();
    const second = await listExplorePosts({ cursor: first.nextCursor }, { ...s, now: T });
    expect(idsOf(second)).toEqual([expected[24]]);
    expect(second.nextCursor).toBeNull();

    await t.db.delete(posts).where(eq(posts.id, expected[24]!));
    const exact = await listExplorePosts({}, { ...s, now: T });
    expect(exact.items).toHaveLength(24);
    expect(exact.nextCursor).toBeNull();
  });

  it('0 件のときは空の一覧を返す', async () => {
    const s = await setup();
    expect(await listExplorePosts({}, { ...s, now: T })).toEqual({ items: [], nextCursor: null });
  });

  it('2 ページ目は 1 ページ目と同じ時刻の窓で数え、同じ投稿を 2 度出さない', async () => {
    const s = await setup();
    const head = [];
    for (let i = 0; i < 24; i++) head.push(await liked(s.author.id, 10, T - HOUR - i * MIN));
    const edge = await liked(s.author.id, 1, T - 7 * DAY + 30 * MIN);
    const grown = await liked(s.author.id, 1, T - 2 * HOUR);

    const first = await listExplorePosts({}, { ...s, now: T });
    expect(idsOf(first)).toEqual(head.map((p) => p.id));
    // Likes grow on the second page's posts; an hour later `edge` is out of a window counted at now.
    await t.db.update(posts).set({ likeCount: 5 }).where(eq(posts.id, grown.id));
    await t.db.update(posts).set({ likeCount: 2 }).where(eq(posts.id, edge.id));

    const second = await listExplorePosts({ cursor: first.nextCursor }, { ...s, now: T + HOUR });
    expect(idsOf(second)).toEqual([grown.id, edge.id]);
    expect(second.nextCursor).toBeNull();
    for (const id of idsOf(first)) expect(idsOf(second)).not.toContain(id);
  });

  it('壊れたカーソルは VALIDATION', async () => {
    const s = await setup();
    for (const cursor of ['%%%', 5, {}, Buffer.from('1|2').toString('base64url')]) {
      const err = await rejection(() => listExplorePosts({ cursor }, { ...s, now: T }));
      expect(err.code, String(cursor)).toBe('VALIDATION');
    }
    const future = Buffer.from(`${T + 1}|1|2026-11-20T00:00:00.000Z|a`).toString('base64url');
    const err = await rejection(() => listExplorePosts({ cursor: future }, { ...s, now: T }));
    expect(err.code).toBe('VALIDATION');
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const s = await setup();
    const err = await rejection(() =>
      listExplorePosts({}, { env: s.env, headers: new Headers(), now: T }),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('応答の行は PostTile の項目だけで内部の列を含めない', async () => {
    const s = await setup();
    await liked(s.author.id, 2, T - HOUR, 2);
    const page = await listExplorePosts({}, { ...s, now: T });
    expect(Object.keys(page.items[0]!).sort()).toEqual(['cover', 'id', 'mediaCount', 'username']);
    expect(page.items[0]).toMatchObject({ mediaCount: 2, username: s.author.username });
    const json = JSON.stringify(page);
    for (const hidden of ['storageKey', 'authorId', 'likeCount', 'email']) {
      expect(json).not.toContain(hidden);
    }
  });

  it('7 日の窓を posts_created_at_id_idx で絞る', async () => {
    const s = await setup();
    const built = exploreQuery(t.db, s.viewer.id, T, null).toSQL();
    // The helper's D1 type has no bind(); the real binding does.
    const d1 = t.d1 as unknown as {
      prepare(sql: string): {
        bind(...params: unknown[]): { all<R>(): Promise<{ results: R[] }> };
      };
    };
    const plan = await d1
      .prepare(`EXPLAIN QUERY PLAN ${built.sql}`)
      .bind(...built.params)
      .all<{ detail: string }>();
    const details = plan.results.map((r) => r.detail);
    expect(details.some((d) => d.includes('posts_created_at_id_idx'))).toBe(true);
    expect(details.some((d) => /^SCAN posts\b/.test(d))).toBe(false);
  });
});
