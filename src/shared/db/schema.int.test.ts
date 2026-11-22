import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { describe, expect, it } from 'vitest';
import { applyMigrations, useTestDb } from '../../../tests/helpers/db';
import {
  accounts,
  comments,
  follows,
  hashtags,
  likes,
  media,
  postHashtags,
  posts,
  rateLimits,
  sessions,
  storageOrphans,
  users,
  verifications,
} from './schema';

const t = useTestDb();

type Row = Record<string, string | number | null>;
const NOW = 1_700_000_000_000;

async function insert(table: string, row: Row) {
  const cols = Object.keys(row);
  const stmt = t.d1.prepare(
    `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
  );
  return (stmt as unknown as { bind(...v: unknown[]): { run(): Promise<unknown> } })
    .bind(...cols.map((c) => row[c]))
    .run();
}
const user = (id: string, over: Row = {}) =>
  insert('users', {
    id,
    username: `user_${id}`,
    display_name: `User ${id}`,
    email: `${id}@example.com`,
    created_at: NOW,
    updated_at: NOW,
    ...over,
  });
const post = (id: string, author: string, over: Row = {}) =>
  insert('posts', { id, author_id: author, created_at: NOW, ...over });
const medium = (id: string, postId: string, over: Row = {}) =>
  insert('media', {
    id,
    post_id: postId,
    position: 0,
    type: 'image',
    storage_key: `media/u/${id}`,
    width: 10,
    height: 10,
    thumbhash: 'x',
    ...over,
  });
const comment = (id: string, postId: string, author: string, over: Row = {}) =>
  insert('comments', {
    id,
    post_id: postId,
    author_id: author,
    body: 'hi',
    created_at: NOW,
    ...over,
  });
const count = async (table: string, where = '1 = 1') =>
  (await t.d1.prepare(`SELECT count(*) AS n FROM ${table} WHERE ${where}`).all<{ n: number }>())
    .results[0].n;
const names = async (type: 'table' | 'index') =>
  (
    await t.d1
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = '${type}' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' AND name <> 'd1_migrations'`,
      )
      .all<{ name: string }>()
  ).results.map((r) => r.name);

describe('マイグレーション', () => {
  it('マイグレーションで 15 個のテーブルと 10 個の索引ができる', async () => {
    expect(await names('table')).toEqual(
      expect.arrayContaining([
        'users',
        'posts',
        'media',
        'likes',
        'comments',
        'follows',
        'rate_limits',
        'storage_orphans',
        'stories',
        'story_views',
        'hashtags',
        'post_hashtags',
      ]),
    );
    expect(await names('index')).toEqual(
      expect.arrayContaining([
        'posts_author_id_created_at_id_idx',
        'posts_created_at_id_idx',
        'likes_post_id_created_at_idx',
        'comments_post_parent_created_idx',
        'follows_followee_created_idx',
        'post_hashtags_hashtag_created_post_idx',
      ]),
    );
    expect(await names('table')).toHaveLength(15);
  });

  it('マイグレーションを 2 回当てても失敗しない', async () => {
    const before = await names('table');
    await applyMigrations(t.d1 as never);
    expect(await names('table')).toEqual(before);
    expect(before).toHaveLength(15);
  });

  it('Drizzle のスキーマの列はマイグレーションと一致する', async () => {
    for (const table of [
      users,
      posts,
      media,
      likes,
      comments,
      follows,
      rateLimits,
      storageOrphans,
      sessions,
      accounts,
      verifications,
      hashtags,
      postHashtags,
    ]) {
      const cfg = getTableConfig(table);
      const info = (
        await t.d1
          .prepare(`PRAGMA table_info(${cfg.name})`)
          .all<{ name: string; notnull: number }>()
      ).results;
      expect(info.map((c) => c.name).sort(), cfg.name).toEqual(
        cfg.columns.map((c) => c.name).sort(),
      );
    }
  });
});

describe('制約', () => {
  it('同じ利用者が同じ投稿に 2 回いいねすると拒まれる', async () => {
    await user('u1');
    await post('p1', 'u1');
    await insert('likes', { user_id: 'u1', post_id: 'p1', created_at: NOW });
    await expect(
      insert('likes', { user_id: 'u1', post_id: 'p1', created_at: NOW }),
    ).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('自分自身のフォローは拒まれる', async () => {
    await user('a');
    await expect(
      insert('follows', { follower_id: 'a', followee_id: 'a', created_at: NOW }),
    ).rejects.toThrow(/follows_follower_id_check/);
  });

  it('他の利用者のフォローは通る', async () => {
    await user('a');
    await user('b');
    await insert('follows', { follower_id: 'a', followee_id: 'b', created_at: NOW });
    expect(await count('follows')).toBe(1);
  });

  const exact = (n: number, ch = 'あ') => ch.repeat(n);

  it.each([
    [
      'display_name',
      'users',
      'users_display_name_check',
      30,
      (v: string) => user('x', { display_name: v }),
    ],
    ['bio', 'users', 'users_bio_check', 150, (v: string) => user('x', { bio: v })],
    [
      'caption',
      'posts',
      'posts_caption_check',
      2200,
      async (v: string) => {
        await user('x');
        await post('p', 'x', { caption: v });
      },
    ],
    [
      'body',
      'comments',
      'comments_body_check',
      2200,
      async (v: string) => {
        await user('x');
        await post('p', 'x');
        await comment('c', 'p', 'x', { body: v });
      },
    ],
    [
      'alt_text',
      'media',
      'media_alt_text_check',
      500,
      async (v: string) => {
        await user('x');
        await post('p', 'x');
        await medium('m', 'p', { alt_text: v });
      },
    ],
  ])('%s は上限ちょうどで通り 1 字超で拒まれる', async (_col, table, constraint, max, run) => {
    await run(exact(max));
    expect(await count(table)).toBe(1);
    await t.d1.prepare('DELETE FROM users').run();
    await expect(run(exact(max + 1))).rejects.toThrow(new RegExp(constraint));
  });

  it('bio は 150 字で通り 151 字で拒まれる', async () => {
    await user('a', { bio: 'a'.repeat(150) });
    await expect(user('b', { bio: 'a'.repeat(151) })).rejects.toThrow(/users_bio_check/);
  });

  it.each(['', ' ', ' \t\n', '　'])('display_name と body は空（%j）が拒まれる', async (v) => {
    await expect(user('a', { display_name: v })).rejects.toThrow(/users_display_name_check/);
    await user('b');
    await post('p', 'b');
    await expect(comment('c', 'p', 'b', { body: v })).rejects.toThrow(/comments_body_check/);
  });

  it('display_name と body は前後の空白を除いた長さで数える', async () => {
    await user('a', { display_name: `  ${'a'.repeat(30)}  ` });
    await user('b', {
      display_name: ` ${'a'.repeat(31)} `,
      username: 'bbb',
      email: 'b2@example.com',
    }).then(
      () => expect.unreachable(),
      (e: Error) => expect(e.message).toMatch(/users_display_name_check/),
    );
  });

  it('username と email は小文字だけ', async () => {
    await expect(user('a', { username: 'Alice' })).rejects.toThrow(/users_username_check/);
    await expect(user('b', { email: 'B@example.com' })).rejects.toThrow(/users_email_check/);
    await user('c', { username: 'alice', email: 'alice@example.com' });
  });

  it('username と email は重複できない', async () => {
    await user('a', { username: 'alice', email: 'a@example.com' });
    await expect(user('b', { username: 'alice', email: 'b@example.com' })).rejects.toThrow(
      /UNIQUE constraint failed: users.username/,
    );
    await expect(user('c', { username: 'carol', email: 'a@example.com' })).rejects.toThrow(
      /UNIQUE constraint failed: users.email/,
    );
  });

  it('username は 3 字で通り 2 字で拒まれる', async () => {
    await user('a', { username: 'abc' });
    await expect(user('b', { username: 'ab' })).rejects.toThrow(/users_username_check/);
    await user('c', { username: 'c'.repeat(30) });
    await expect(user('d', { username: 'd'.repeat(31) })).rejects.toThrow(/users_username_check/);
  });

  it('position は 9 で通り 10 で拒まれる', async () => {
    await user('u');
    await post('p', 'u');
    await medium('m9', 'p', { position: 9 });
    await expect(medium('m10', 'p', { position: 10 })).rejects.toThrow(/media_position_check/);
  });

  it('同じ投稿の同じ position は拒まれる', async () => {
    await user('u');
    await post('p', 'u');
    await medium('m1', 'p', { position: 1 });
    await expect(medium('m2', 'p', { position: 1 })).rejects.toThrow(/UNIQUE constraint failed/);
  });

  it('width が 0 のとき拒まれる', async () => {
    await user('u');
    await post('p', 'u');
    await expect(medium('m', 'p', { width: 0 })).rejects.toThrow(/media_width_check/);
  });

  it('like_count に -1 を入れると拒まれる', async () => {
    await user('u');
    await expect(post('p', 'u', { like_count: -1 })).rejects.toThrow(/posts_like_count_check/);
    await expect(post('p', 'u', { comment_count: -1 })).rejects.toThrow(
      /posts_comment_count_check/,
    );
  });
});

describe('削除の連鎖', () => {
  async function seed() {
    await user('a');
    await user('b');
    await post('p1', 'a');
    await post('p2', 'b');
    await medium('m1', 'p1');
    await medium('m2', 'p2');
    await insert('likes', { user_id: 'b', post_id: 'p1', created_at: NOW });
    await insert('likes', { user_id: 'a', post_id: 'p2', created_at: NOW });
    await comment('c1', 'p1', 'b');
    await comment('r1', 'p1', 'a', { parent_id: 'c1' });
    await comment('c2', 'p2', 'a');
    await insert('follows', { follower_id: 'a', followee_id: 'b', created_at: NOW });
    await insert('follows', { follower_id: 'b', followee_id: 'a', created_at: NOW });
  }

  it('投稿を消すと従属の行が消える', async () => {
    await seed();
    await t.d1.prepare("DELETE FROM posts WHERE id = 'p1'").run();
    expect(await count('media', "post_id = 'p1'")).toBe(0);
    expect(await count('likes', "post_id = 'p1'")).toBe(0);
    expect(await count('comments', "post_id = 'p1'")).toBe(0);
    expect(await count('media', "post_id = 'p2'")).toBe(1);
    expect(await count('likes', "post_id = 'p2'")).toBe(1);
    expect(await count('comments', "post_id = 'p2'")).toBe(1);
    expect(await count('posts')).toBe(1);
  });

  it('利用者を消すと投稿といいねとフォローが消える', async () => {
    await seed();
    await t.d1.prepare("DELETE FROM users WHERE id = 'a'").run();
    expect(await count('posts', "author_id = 'a'")).toBe(0);
    expect(await count('likes', "user_id = 'a' OR post_id = 'p1'")).toBe(0);
    expect(await count('comments', "author_id = 'a'")).toBe(0);
    expect(await count('follows')).toBe(0);
    expect(await count('posts')).toBe(1);
  });

  it('親のコメントを消すと返信が消える', async () => {
    await seed();
    await t.d1.prepare("DELETE FROM comments WHERE id = 'c1'").run();
    expect(await count('comments', "id = 'r1'")).toBe(0);
    expect(await count('comments', "id = 'c2'")).toBe(1);
  });
});
