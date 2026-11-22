import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../tests/helpers/db';
import { createComment, createLike, createPost } from '../../tests/helpers/posts';
import { createUser } from '../../tests/helpers/users';
import { cleanupOldNotifications } from './notification-cleanup';
import type { JobD1, JobEnv } from './types';

const t = useTestDb();
/** The test D1 typed like a job's binding, so statements can `bind`. */
const bound = (): JobD1 => t.d1 as unknown as JobD1;

const NOW = new Date('2026-11-22T00:00:00.000Z');
const DAY = 86_400_000;
const RETENTION = 90 * DAY;

/** A D1 binding that records every statement it prepares. */
const counted = (): { env: JobEnv; sql: string[] } => {
  const sql: string[] = [];
  const DB: JobD1 = {
    prepare: (s) => {
      sql.push(s);
      return t.d1.prepare(s) as never;
    },
    batch: (s) => t.d1.batch(s as never[]),
  };
  return { env: { DB } as unknown as JobEnv, sql };
};
const plainEnv = (): JobEnv => ({ DB: bound() }) as unknown as JobEnv;
const deleteStatements = (sql: string[]) => sql.filter((s) => s.startsWith('DELETE'));

async function pair() {
  const a = await createUser(t.db);
  const b = await createUser(t.db);
  return { a, b };
}

/** Inserts `createdAts.length` follow notifications (one actor each) in batches of statements. */
async function addFollows(recipientId: string, createdAts: number[], readAt: number | null = null) {
  const ids: string[] = [];
  const statements = [];
  for (const createdAt of createdAts) {
    const actor = await createUser(t.db);
    const id = crypto.randomUUID();
    ids.push(id);
    statements.push(
      bound()
        .prepare(
          "INSERT INTO notifications (id, recipient_id, actor_id, type, read_at, created_at) VALUES (?1, ?2, ?3, 'follow', ?4, ?5)",
        )
        .bind(id, recipientId, actor.id, readAt, createdAt),
    );
  }
  await t.d1.batch(statements);
  return ids;
}

/** Many follow notifications from one actor each is slow; for bulk use distinct actors via one batch of users. */
async function addBulk(recipientId: string, createdAts: number[]) {
  const actors: string[] = [];
  for (let i = 0; i < createdAts.length; i += 50) {
    const chunk = await Promise.all(
      createdAts.slice(i, i + 50).map(() => createUser(t.db).then((u) => u.id)),
    );
    actors.push(...chunk);
  }
  const statements = createdAts.map((createdAt, i) =>
    bound()
      .prepare(
        "INSERT INTO notifications (id, recipient_id, actor_id, type, created_at) VALUES (?1, ?2, ?3, 'follow', ?4)",
      )
      .bind(crypto.randomUUID(), recipientId, actors[i], createdAt),
  );
  for (let i = 0; i < statements.length; i += 100) {
    await t.d1.batch(statements.slice(i, i + 100));
  }
}

const remainingIds = async () =>
  (
    await t.d1.prepare('SELECT id FROM notifications ORDER BY id').all<{ id: string }>()
  ).results.map((r) => r.id);
const count = async (table: string) =>
  (await t.d1.prepare(`SELECT COUNT(*) AS c FROM ${table}`).all<{ c: number }>()).results[0]!.c;

describe('cleanupOldNotifications', () => {
  it('90 日と 1 ミリ秒前を消し、ちょうど 90 日前と 89 日前を残す', async () => {
    const { a } = await pair();
    const cutoff = NOW.getTime() - RETENTION;
    const [old, exact, recent] = await addFollows(a.id, [
      cutoff - 1,
      cutoff,
      NOW.getTime() - 89 * DAY,
    ]);

    const result = await cleanupOldNotifications({ env: plainEnv(), now: NOW });

    expect(result).toEqual({ deleted: 1 });
    const left = await remainingIds();
    expect(left).not.toContain(old);
    expect(left.sort()).toEqual([exact!, recent!].sort());
  });

  it('既読と未読と全ての種類を消し、他の表に触れない', async () => {
    const { a, b } = await pair();
    const post = await createPost(t.db, a.id);
    const comment = await createComment(t.db, post.id, b.id);
    await createLike(t.db, b.id, post.id);
    await bound()
      .prepare('INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?1, ?2, ?3)')
      .bind(b.id, a.id, NOW.getTime())
      .run();
    const old = NOW.getTime() - 100 * DAY;
    const ins = (
      id: string,
      type: string,
      postId: string | null,
      commentId: string | null,
      readAt: number | null,
    ) =>
      bound()
        .prepare(
          'INSERT INTO notifications (id, recipient_id, actor_id, type, post_id, comment_id, read_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
        )
        .bind(id, a.id, b.id, type, postId, commentId, readAt, old);
    await t.d1.batch([
      ins('n-like-unread', 'like', post.id, null, null),
      ins('n-comment-read', 'comment', post.id, comment, old + 1),
      ins('n-follow-unread', 'follow', null, null, null),
    ]);
    const before = {
      users: await count('users'),
      posts: await count('posts'),
      comments: await count('comments'),
      likes: await count('likes'),
      follows: await count('follows'),
    };

    const result = await cleanupOldNotifications({ env: plainEnv(), now: NOW });

    expect(result).toEqual({ deleted: 3 });
    expect(await count('notifications')).toBe(0);
    expect({
      users: await count('users'),
      posts: await count('posts'),
      comments: await count('comments'),
      likes: await count('likes'),
      follows: await count('follows'),
    }).toEqual(before);
  });

  it('1,200 件を 500 件ずつ消し、500 件ちょうどは 2 文目の 0 件で終わる', async () => {
    const { a } = await pair();
    await addBulk(
      a.id,
      Array.from({ length: 1200 }, (_, i) => NOW.getTime() - RETENTION - 1 - i),
    );
    const first = counted();
    expect(await cleanupOldNotifications({ env: first.env, now: NOW })).toEqual({ deleted: 1200 });
    expect(deleteStatements(first.sql)).toHaveLength(3);
    expect(await count('notifications')).toBe(0);

    await addBulk(
      a.id,
      Array.from({ length: 500 }, (_, i) => NOW.getTime() - RETENTION - 1 - i),
    );
    const second = counted();
    expect(await cleanupOldNotifications({ env: second.env, now: NOW })).toEqual({ deleted: 500 });
    expect(deleteStatements(second.sql)).toHaveLength(2);
  }, 60_000);

  it('1 回の上限で止め、残りを次の実行に回す', async () => {
    const { a } = await pair();
    const old = (n: number) =>
      Array.from({ length: n }, (_, i) => NOW.getTime() - RETENTION - 1 - i);
    await addFollows(a.id, old(21));
    const limited = counted();
    const r = await cleanupOldNotifications(
      { env: limited.env, now: NOW },
      { batchSize: 10, maxBatches: 2 },
    );
    expect(r).toEqual({ deleted: 20 });
    expect(await count('notifications')).toBe(1);

    await t.d1.prepare('DELETE FROM notifications').run();
    await addFollows(a.id, old(20));
    const exact = counted();
    const r2 = await cleanupOldNotifications(
      { env: exact.env, now: NOW },
      { batchSize: 10, maxBatches: 2 },
    );
    expect(r2).toEqual({ deleted: 20 });
    expect(await count('notifications')).toBe(0);
    expect(deleteStatements(exact.sql)).toHaveLength(2);
  });

  it('対象が無いときと 2 回目は何も消さない', async () => {
    const { a } = await pair();
    await addFollows(a.id, [NOW.getTime() - DAY]);
    const before = await remainingIds();
    expect(await cleanupOldNotifications({ env: plainEnv(), now: NOW })).toEqual({ deleted: 0 });
    expect(await cleanupOldNotifications({ env: plainEnv(), now: NOW })).toEqual({ deleted: 0 });
    expect(await remainingIds()).toEqual(before);
  });

  it('削除の検索が created_at の索引を使う', async () => {
    const plan = await bound()
      .prepare(
        'EXPLAIN QUERY PLAN SELECT id FROM notifications WHERE created_at < ?1 ORDER BY created_at LIMIT ?2',
      )
      .bind(1, 500)
      .all<{ detail: string }>();
    const text = plan.results.map((r) => r.detail).join('\n');
    expect(text).toContain('notifications_created_at_idx');
    expect(text).not.toMatch(/SCAN notifications(?! USING)/);
  });
});
