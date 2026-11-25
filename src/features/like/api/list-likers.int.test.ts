import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser, type TestUser } from '../../../../tests/helpers/users';
import { encodeCursor } from '../../../shared/db/cursor';
import { likes, users } from '../../../shared/db/schema';
import { eq } from 'drizzle-orm';
import type { StorageEnv } from '../../../shared/storage';
import { listLikers } from './list-likers';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});
const env = () => ({ ...testAuthEnv(t.d1), ...storage });

/** `n` users who liked the post, the i-th at base + i seconds (so later index = newer). */
const seedLikers = async (postId: string, n: number, same = false) => {
  const made: TestUser[] = [];
  const base = Date.parse('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < n; i += 1) {
    const u = await createUser(t.db);
    made.push(u);
    await t.db
      .insert(likes)
      .values({ userId: u.id, postId, createdAt: new Date(same ? base : base + i * 1000) });
  }
  return made;
};

describe('listLikers', () => {
  it('20 人ちょうどのとき nextCursor が null', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    await seedLikers(post.id, 20);
    const page = await listLikers({ postId: post.id }, { env: env() });
    expect(page.items).toHaveLength(20);
    expect(page.nextCursor).toBeNull();
  });

  it('21 人のとき 2 ページ目に 1 件', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const made = await seedLikers(post.id, 21);
    const first = await listLikers({ postId: post.id }, { env: env() });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    // Newest like first: the last seeded user leads, the first seeded user is on page 2.
    expect(first.items[0]!.username).toBe(made[20]!.username);
    const second = await listLikers({ postId: post.id, cursor: first.nextCursor! }, { env: env() });
    expect(second.items.map((i) => i.username)).toEqual([made[0]!.username]);
    expect(second.nextCursor).toBeNull();
  });

  it('同じ時刻のいいねは user_id の大きい順に並び 取りこぼしも重複も無い', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const made = await seedLikers(post.id, 25, true);
    const first = await listLikers({ postId: post.id }, { env: env() });
    const second = await listLikers({ postId: post.id, cursor: first.nextCursor! }, { env: env() });
    const names = [...first.items, ...second.items].map((i) => i.username);
    expect(new Set(names).size).toBe(25);
    const expected = [...made].sort((x, y) => (x.id < y.id ? 1 : -1)).map((u) => u.username);
    expect(names).toEqual(expected);
  });

  it('UserSummary だけを返す（email などを含まない）', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    const [liker] = await seedLikers(post.id, 1);
    await t.db
      .update(users)
      .set({ avatarKey: `media/${liker!.id}/av` })
      .where(eq(users.id, liker!.id));
    const page = await listLikers({ postId: post.id }, { env: env() });
    const item = page.items[0]!;
    expect(Object.keys(item).sort()).toEqual(['avatarUrl', 'displayName', 'username']);
    expect(item.avatarUrl).toContain(`media/${liker!.id}/av/w320.webp`);
  });

  it('壊れたカーソルのとき VALIDATION を返す', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    for (const cursor of ['!!!', 'abc', encodeCursor({ createdAt: new Date(), id: '' })]) {
      const err = await listLikers({ postId: post.id, cursor }, { env: env() }).catch((e) => e);
      expect(err, cursor).toMatchObject({ code: 'VALIDATION' });
    }
  });

  it('ログインしていなくても呼べて、存在しない投稿のとき NOT_FOUND を返す', async () => {
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id);
    expect((await listLikers({ postId: post.id }, { env: env() })).items).toEqual([]);
    const err = await listLikers({ postId: crypto.randomUUID() }, { env: env() }).catch((e) => e);
    expect(err).toMatchObject({ code: 'NOT_FOUND' });
  });
});
