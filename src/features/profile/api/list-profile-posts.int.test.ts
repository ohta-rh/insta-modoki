import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { encodeCursor } from '../../../shared/db/cursor';
import type { StorageEnv } from '../../../shared/storage';
import { listProfilePosts } from './list-profile-posts';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const BASE = Date.UTC(2026, 10, 1);

/** `n` posts for `authorId`, one minute apart, oldest first; returns them newest first. */
async function seedPosts(authorId: string, n: number) {
  const made = [];
  for (let i = 0; i < n; i++) {
    made.push(await createPost(t.db, authorId, { createdAt: new Date(BASE + i * 60_000) }));
  }
  return made.reverse();
}

describe('listProfilePosts', () => {
  it('12 件ちょうどのとき nextCursor が null になる', async () => {
    const author = await createUser(t.db);
    const expected = await seedPosts(author.id, 12);
    const page = await listProfilePosts({ username: author.username }, { env: env() });
    expect(page.items.map((i) => i.id)).toEqual(expected.map((p) => p.id));
    expect(page.nextCursor).toBeNull();
  });

  it('13 件のとき 2 ページ目に 1 件だけ返る', async () => {
    const author = await createUser(t.db);
    const expected = await seedPosts(author.id, 13);
    const first = await listProfilePosts({ username: author.username }, { env: env() });
    expect(first.items).toHaveLength(12);
    expect(first.nextCursor).not.toBeNull();
    const second = await listProfilePosts(
      { username: author.username, cursor: first.nextCursor },
      { env: env() },
    );
    expect(second.items.map((i) => i.id)).toEqual([expected[12]!.id]);
    expect(second.nextCursor).toBeNull();
  });

  it('同じ時刻の投稿も id の降順で欠けも重なりもなく並ぶ', async () => {
    const author = await createUser(t.db);
    const same = new Date(BASE);
    const made = [];
    for (let i = 0; i < 14; i++) made.push(await createPost(t.db, author.id, { createdAt: same }));
    const ids = made
      .map((p) => p.id)
      .sort()
      .reverse();
    const first = await listProfilePosts({ username: author.username }, { env: env() });
    const second = await listProfilePosts(
      { username: author.username, cursor: first.nextCursor },
      { env: env() },
    );
    expect([...first.items, ...second.items].map((i) => i.id)).toEqual(ids);
  });

  it('表紙は position 0 の写真で mediaCount は写真の枚数になる', async () => {
    const author = await createUser(t.db);
    const other = await createUser(t.db);
    const post = await createPost(t.db, author.id, {
      mediaCount: 3,
      altText: '猫',
      width: 1600,
      height: 900,
    });
    await createPost(t.db, other.id, { mediaCount: 2 });
    const page = await listProfilePosts({ username: author.username }, { env: env() });
    expect(page.items).toHaveLength(1);
    const thumb = page.items[0]!;
    expect(thumb.mediaCount).toBe(3);
    expect(Object.keys(thumb).sort()).toEqual(['cover', 'id', 'mediaCount']);
    expect(thumb.cover).toMatchObject({ type: 'image', width: 1600, height: 900, altText: '猫' });
    expect(thumb.cover.srcset.w320).toContain(`${post.media[0]!.storageKey}/w320.webp`);
    expect(thumb.cover.srcset.w640).toContain(`${post.media[0]!.storageKey}/w640.webp`);
    expect(JSON.stringify(page)).not.toContain('"storageKey"');
  });

  it('大文字小文字が違う username でも同じ一覧を返す', async () => {
    const author = await createUser(t.db, { username: 'haru_list' });
    await seedPosts(author.id, 2);
    const page = await listProfilePosts({ username: 'HARU_LIST' }, { env: env() });
    expect(page.items).toHaveLength(2);
  });

  it('存在しない・形式が不正な username のとき NOT_FOUND を返す', async () => {
    for (const username of ['nobody_here', '.abc', 'a', '', 'accounts', 7, undefined]) {
      const err = await listProfilePosts({ username }, { env: env() }).catch((x) => x);
      expect(err, String(username)).toMatchObject({ code: 'NOT_FOUND' });
    }
  });

  it('壊れたカーソルのとき VALIDATION を返す', async () => {
    const author = await createUser(t.db);
    await seedPosts(author.id, 1);
    for (const cursor of [
      '!!!***',
      encodeCursor({ createdAt: new Date(0), id: 'x' }).slice(2),
      5,
    ]) {
      const err = await listProfilePosts(
        { username: author.username, cursor },
        { env: env() },
      ).catch((x) => x);
      expect(err, String(cursor)).toMatchObject({ code: 'VALIDATION' });
    }
  });
});
