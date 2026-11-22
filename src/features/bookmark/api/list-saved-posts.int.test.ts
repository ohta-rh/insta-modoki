import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createBookmark, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { bookmarks } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { deletePost } from '../../post';
import { listSavedPosts } from './list-saved-posts';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const BASE = Date.UTC(2026, 10, 1);

async function setup() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const a = await createUser(t.db);
  const headers = await sessionHeadersFor(t.db, env, a);
  const author = await createUser(t.db);
  return { env, a, headers, author };
}

/** `n` posts saved by `userId`, the i-th saved one minute after the one before; newest save first. */
async function seed(userId: string, authorId: string, n: number) {
  const made = [];
  for (let i = 0; i < n; i++) {
    // Post creation order is the reverse of the save order, so the list cannot sort by posts.
    const post = await createPost(t.db, authorId, { createdAt: new Date(BASE + (n - i) * 1000) });
    await createBookmark(t.db, userId, post.id, new Date(BASE + i * 60_000));
    made.push(post);
  }
  return made.reverse();
}
const code = (run: () => Promise<unknown>) =>
  run().then(
    () => 'ok',
    (e: { code: string }) => e.code,
  );

describe('listSavedPosts', () => {
  it('保存した新しい順に 12 件ずつ返し、12 件ちょうどは 1 ページで終わる', async () => {
    const { env, a, headers, author } = await setup();
    const saved = await seed(a.id, author.id, 13);

    const first = await listSavedPosts({}, { env, headers });
    expect(first.items.map((i) => i.id)).toEqual(saved.slice(0, 12).map((p) => p.id));
    expect(first.nextCursor).not.toBeNull();
    expect(first.items[0]).toMatchObject({ mediaCount: 1, username: expect.any(String) });
    const second = await listSavedPosts({ cursor: first.nextCursor! }, { env, headers });
    expect(second.items.map((i) => i.id)).toEqual([saved[12]!.id]);
    expect(second.nextCursor).toBeNull();

    await t.db.delete(bookmarks).where(eq(bookmarks.postId, saved[12]!.id));
    const exact = await listSavedPosts({}, { env, headers });
    expect(exact.items).toHaveLength(12);
    expect(exact.nextCursor).toBeNull();
  });

  it('保存が 0 件なら items が空で nextCursor が null', async () => {
    const { env, headers } = await setup();
    expect(await listSavedPosts({}, { env, headers })).toEqual({ items: [], nextCursor: null });
  });

  it('保存の時刻が同じでもページの境目で重複も欠けも無い', async () => {
    const { env, a, headers, author } = await setup();
    const posts = [];
    for (let i = 0; i < 14; i++) posts.push(await createPost(t.db, author.id));
    for (const p of posts) await createBookmark(t.db, a.id, p.id, new Date(BASE));

    const first = await listSavedPosts({}, { env, headers });
    const second = await listSavedPosts({ cursor: first.nextCursor! }, { env, headers });
    const ids = [...first.items, ...second.items].map((i) => i.id);
    expect(ids).toEqual(
      posts
        .map((p) => p.id)
        .sort()
        .reverse(),
    );
    expect(second.nextCursor).toBeNull();
  });

  it('壊れたカーソルは VALIDATION', async () => {
    const { env, headers } = await setup();
    for (const cursor of ['!!', Buffer.from('abc').toString('base64url'), 123]) {
      expect(await code(() => listSavedPosts({ cursor }, { env, headers })), String(cursor)).toBe(
        'VALIDATION',
      );
    }
  });

  it('自分の保存だけを返し、他人を指定する入力を拒む', async () => {
    const { env, a, headers, author } = await setup();
    const b = await createUser(t.db);
    const mine = await createPost(t.db, author.id);
    const theirs = await createPost(t.db, author.id);
    await createBookmark(t.db, a.id, mine.id);
    await createBookmark(t.db, b.id, theirs.id);

    const page = await listSavedPosts({}, { env, headers });
    expect(page.items.map((i) => i.id)).toEqual([mine.id]);
    for (const input of [{ userId: b.id }, { username: 'someone' }]) {
      expect(await code(() => listSavedPosts(input, { env, headers }))).toBe('VALIDATION');
    }
    expect(await code(() => listSavedPosts({}, { env, headers: new Headers() }))).toBe(
      'UNAUTHENTICATED',
    );
  });

  it('削除された投稿は保存の一覧から消える', async () => {
    const { env, a, headers, author } = await setup();
    const keep = await createPost(t.db, author.id);
    const gone = await createPost(t.db, author.id);
    await createBookmark(t.db, a.id, keep.id, new Date(BASE));
    await createBookmark(t.db, a.id, gone.id, new Date(BASE + 1000));
    const authorHeaders = await sessionHeadersFor(t.db, env, author);
    await deletePost({ postId: gone.id }, { env, headers: authorHeaders });

    const page = await listSavedPosts({}, { env, headers });
    expect(page.items.map((i) => i.id)).toEqual([keep.id]);
    expect(await t.db.select().from(bookmarks)).toHaveLength(1);
  });
});
