import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { deletePost } from '../../post';
import { hashtagStatements } from '../db/hashtag-statements';
import { listTagPosts } from './list-tag-posts';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const BASE = Date.UTC(2026, 10, 1);

async function setup() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const viewer = await createUser(t.db);
  const headers = await sessionHeadersFor(t.db, env, viewer);
  return { env, viewer, headers };
}

/** A post tagged `names` at `createdAt` (as createPost stores it). */
async function tagged(authorId: string, names: string[], createdAt: Date, mediaCount = 1) {
  const post = await createPost(t.db, authorId, { createdAt, mediaCount });
  const statements = hashtagStatements(t.db, { postId: post.id, names, createdAt });
  if (statements.length > 0) await t.db.batch(statements as never);
  return post;
}

/** `n` posts tagged `tokyo`, one minute apart; returns them newest first. */
async function seed(authorId: string, n: number) {
  const made = [];
  for (let i = 0; i < n; i++)
    made.push(await tagged(authorId, ['tokyo'], new Date(BASE + i * 60_000)));
  return made.reverse();
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

describe('listTagPosts', () => {
  it('12 件ずつ新しい順に返し、大文字のタグも同じ一覧になる', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    const expected = await seed(author.id, 13);

    const first = await listTagPosts({ tag: 'Tokyo' }, s);
    expect(first.name).toBe('tokyo');
    expect(first.postCount).toBe(13);
    expect(first.items.map((i) => i.id)).toEqual(expected.slice(0, 12).map((p) => p.id));
    expect(first.nextCursor).not.toBeNull();

    const second = await listTagPosts({ tag: 'tokyo', cursor: first.nextCursor }, s);
    expect(second.items.map((i) => i.id)).toEqual([expected[12]!.id]);
    expect(second.nextCursor).toBeNull();
    expect(second.postCount).toBe(13);
  });

  it('12 件ちょうどなら 1 ページで nextCursor が null、同時刻は post_id の降順', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    const same = new Date(BASE);
    const made = [];
    for (let i = 0; i < 12; i++) made.push(await tagged(author.id, ['tokyo'], same));
    const page = await listTagPosts({ tag: 'tokyo' }, s);
    expect(page.items.map((i) => i.id)).toEqual(
      made
        .map((p) => p.id)
        .sort()
        .reverse(),
    );
    expect(page.nextCursor).toBeNull();
  });

  it('壊れたカーソルは VALIDATION', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    await seed(author.id, 1);
    const err = await rejection(() => listTagPosts({ tag: 'tokyo', cursor: '%%%' }, s));
    expect(err.code).toBe('VALIDATION');
  });

  it('知らないタグは NOT_FOUND、投稿が消えたタグは空の一覧を返す', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    const [only] = await seed(author.id, 1);
    for (const tag of ['nothing', '', 'a b', 'a#b', 'a'.repeat(101), 5, undefined]) {
      const err = await rejection(() => listTagPosts({ tag }, s));
      expect(err.code, String(tag)).toBe('NOT_FOUND');
      expect(err.message).toBe('ページが見つかりません');
    }
    await deletePost(
      { postId: only!.id },
      { env: s.env, headers: await sessionHeadersFor(t.db, s.env, author) },
    );
    const page = await listTagPosts({ tag: 'tokyo' }, s);
    expect(page).toMatchObject({ items: [], postCount: 0, nextCursor: null, name: 'tokyo' });
  });

  it('投稿を削除するとタグの一覧から消える', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    const [newest, older] = await seed(author.id, 2);
    const headers = await sessionHeadersFor(t.db, s.env, author);
    await deletePost({ postId: newest!.id }, { env: s.env, headers });
    const page = await listTagPosts({ tag: 'tokyo' }, s);
    expect(page.items.map((i) => i.id)).toEqual([older!.id]);
    expect(page.postCount).toBe(1);
    const left = await t.d1.prepare('SELECT count(*) AS n FROM post_hashtags').all<{ n: number }>();
    expect(left.results[0]!.n).toBe(1);
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const s = await setup();
    const err = await rejection(() =>
      listTagPosts({ tag: 'tokyo' }, { env: s.env, headers: new Headers() }),
    );
    expect(err.code).toBe('UNAUTHENTICATED');
  });

  it('応答の行は PostTile の項目だけで内部の列を含めない', async () => {
    const s = await setup();
    const author = await createUser(t.db);
    await tagged(author.id, ['tokyo'], new Date(BASE), 2);
    const page = await listTagPosts({ tag: 'tokyo' }, s);
    expect(Object.keys(page.items[0]!).sort()).toEqual(['cover', 'id', 'mediaCount', 'username']);
    expect(page.items[0]).toMatchObject({ mediaCount: 2, username: author.username });
    const json = JSON.stringify(page);
    for (const hidden of ['storageKey', 'authorId', 'email']) expect(json).not.toContain(hidden);
  });
});
