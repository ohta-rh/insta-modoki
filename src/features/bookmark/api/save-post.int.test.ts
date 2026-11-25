import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { bookmarks } from '../../../shared/db/schema';
import { savePost } from './save-post';
import { unsavePost } from './unsave-post';

const t = useTestDb();

const setup = async () => {
  const env = testAuthEnv(t.d1);
  const author = await createUser(t.db);
  const post = await createPost(t.db, author.id);
  const a = await createUser(t.db);
  const headers = await sessionHeadersFor(t.db, env, a);
  return { env, author, post, a, headers };
};
const rows = (postId: string) => t.db.select().from(bookmarks).where(eq(bookmarks.postId, postId));
const allRows = () => t.db.select().from(bookmarks);

describe('savePost / unsavePost', () => {
  it('2 回保存しても 1 行で、2 回解除しても 0 行のまま、どれも同じ結果を返す', async () => {
    const { env, post, a, headers } = await setup();
    const deps = { env, headers };

    expect(await savePost({ postId: post.id }, deps)).toEqual({ saved: true });
    expect(await savePost({ postId: post.id }, deps)).toEqual({ saved: true });
    const saved = await rows(post.id);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ userId: a.id, postId: post.id });

    expect(await unsavePost({ postId: post.id }, deps)).toEqual({ saved: false });
    expect(await unsavePost({ postId: post.id }, deps)).toEqual({ saved: false });
    expect(await rows(post.id)).toHaveLength(0);
  });

  it('保存した時刻は now で、2 回目の保存で上書きされない', async () => {
    const { env, post, headers } = await setup();
    await savePost({ postId: post.id }, { env, headers, now: 1_700_000_000_000 });
    await savePost({ postId: post.id }, { env, headers, now: 1_800_000_000_000 });
    expect((await rows(post.id))[0]!.createdAt.getTime()).toBe(1_700_000_000_000);
  });

  it('同じ人の同時の 10 回でも 1 行のまま', async () => {
    const { env, post, headers } = await setup();
    const results = await Promise.all(
      Array.from({ length: 10 }, () => savePost({ postId: post.id }, { env, headers })),
    );
    expect(results.every((r) => r.saved === true)).toBe(true);
    expect(await rows(post.id)).toHaveLength(1);
  });

  it('未ログイン・存在しない投稿・余計な項目を拒み、自分の投稿は保存できる', async () => {
    const { env, post, author, headers } = await setup();
    for (const run of [savePost, unsavePost]) {
      const anon = await run({ postId: post.id }, { env, headers: new Headers() }).catch((e) => e);
      expect(anon).toMatchObject({ code: 'UNAUTHENTICATED', message: 'ログインしてください' });
      for (const postId of [crypto.randomUUID(), 'abc', 7]) {
        const err = await run({ postId }, { env, headers }).catch((e) => e);
        expect(err, String(postId)).toMatchObject({
          code: 'NOT_FOUND',
          message: 'ページが見つかりません',
        });
      }
      const extra = await run({ postId: post.id, userId: author.id }, { env, headers }).catch(
        (e) => e,
      );
      expect(extra).toMatchObject({ code: 'VALIDATION', message: '入力を確認してください' });
    }
    expect(await allRows()).toHaveLength(0);

    const ownHeaders = await sessionHeadersFor(t.db, env, author);
    expect(await savePost({ postId: post.id }, { env, headers: ownHeaders })).toEqual({
      saved: true,
    });
    expect(await rows(post.id)).toHaveLength(1);
  });
});
