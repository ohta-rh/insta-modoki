import { beforeAll, describe, expect, it } from 'vitest';
import { countQueries } from '../../../../tests/helpers/count-queries';
import { useTestDb } from '../../../../tests/helpers/db';
import { createBookmark, createLike, createPost } from '../../../../tests/helpers/posts';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { getDb } from '../../../shared/db/client';
import type { StorageEnv } from '../../../shared/storage';
import { loadPostViews } from './load-post-views';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

describe('loadPostViews', () => {
  it('入力の id の順に PostView を返し、写真は position の順で、存在しない id は飛ばす', async () => {
    const author = await createUser(t.db);
    const p1 = await createPost(t.db, author.id, { mediaCount: 3, altText: '猫' });
    const p2 = await createPost(t.db, author.id, { caption: '二つ目' });
    const missing = crypto.randomUUID();
    const views = await loadPostViews(t.db, storage, [p2.id, missing, p1.id], null);
    expect(views.map((v) => v.id)).toEqual([p2.id, p1.id]);
    expect(views[0]!.caption).toBe('二つ目');
    expect(views[1]!.media).toHaveLength(3);
    expect(views[1]!.media[0]!.srcset.w320).toContain(`${p1.media[0]!.storageKey}/w320.webp`);
    expect(views[1]!.media[2]!.srcset.w320).toContain(`${p1.media[2]!.storageKey}/w320.webp`);
  });

  it('likedByMe は閲覧者がいいねした投稿だけ true で、閲覧者がいないときは全て false', async () => {
    const author = await createUser(t.db);
    const viewer = await createUser(t.db);
    const liked = await createPost(t.db, author.id);
    const other = await createPost(t.db, author.id);
    await createLike(t.db, viewer.id, liked.id);
    await createLike(t.db, author.id, other.id);
    const ids = [liked.id, other.id];
    expect((await loadPostViews(t.db, storage, ids, viewer.id)).map((v) => v.likedByMe)).toEqual([
      true,
      false,
    ]);
    expect((await loadPostViews(t.db, storage, ids, null)).map((v) => v.likedByMe)).toEqual([
      false,
      false,
    ]);
  });

  it('savedByMe は閲覧者が保存した投稿だけ true で、閲覧者がいないときは全て false', async () => {
    const author = await createUser(t.db);
    const viewer = await createUser(t.db);
    const saved = await createPost(t.db, author.id);
    const other = await createPost(t.db, author.id);
    await createBookmark(t.db, viewer.id, saved.id);
    await createBookmark(t.db, author.id, other.id);
    const ids = [saved.id, other.id];
    expect((await loadPostViews(t.db, storage, ids, viewer.id)).map((v) => v.savedByMe)).toEqual([
      true,
      false,
    ]);
    expect((await loadPostViews(t.db, storage, ids, null)).map((v) => v.savedByMe)).toEqual([
      false,
      false,
    ]);
  });

  it('120 件でも 1 つの文の変数が 100 を超えず、順序が保たれる', async () => {
    const author = await createUser(t.db);
    const ids: string[] = [];
    for (let i = 0; i < 120; i++) ids.push((await createPost(t.db, author.id)).id);
    const views = await loadPostViews(t.db, storage, ids, author.id);
    expect(views.map((v) => v.id)).toEqual(ids);
    // 120 sequential createPost calls: 4.3 s in CI, over 5 s on a loaded host (2026-11-22).
  }, 30_000);

  it('空の入力は問い合わせずに空の配列を返す', async () => {
    const counted = countQueries(t.d1);
    expect(await loadPostViews(getDb({ DB: counted.d1 as never }), storage, [], null)).toEqual([]);
    expect(counted.count()).toBe(0);
  });

  it('問い合わせの回数は 50 件までなら件数によらず同じ', async () => {
    const author = await createUser(t.db);
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) ids.push((await createPost(t.db, author.id)).id);
    const few = countQueries(t.d1);
    const many = countQueries(t.d1);
    await loadPostViews(getDb({ DB: few.d1 as never }), storage, ids.slice(0, 1), author.id);
    await loadPostViews(getDb({ DB: many.d1 as never }), storage, ids, author.id);
    expect(many.count()).toBe(few.count());
    expect(many.count()).toBe(1);
  });
});
