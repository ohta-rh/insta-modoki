import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser, type TestUser } from '../../../../tests/helpers/users';
import { follows, users } from '../../../shared/db/schema';
import { AppError } from '../../../shared/errors';
import type { StorageEnv } from '../../../shared/storage';
import { listSuggestedUsers } from './list-suggested-users';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const BASE = Date.parse('2026-01-01T00:00:00.000Z');
let serial = 0;
/** A user whose `created_at` is base + `age` seconds (a larger age is a newer account). */
const person = async (username: string, age = 0): Promise<TestUser> => {
  const u = await createUser(t.db, { username });
  await t.db
    .update(users)
    .set({ createdAt: new Date(BASE + age * 1000) })
    .where(eq(users.id, u.id));
  return u;
};
const follow = async (a: TestUser, b: TestUser) => {
  serial += 1;
  await t.db
    .insert(follows)
    .values({ followerId: a.id, followeeId: b.id, createdAt: new Date(BASE + serial * 1000) });
};
const call = async (viewer: TestUser, input: unknown = {}, d1: unknown = t.d1) => {
  const env = { ...testAuthEnv(d1), ...storage };
  const headers = await sessionHeadersFor(t.db, env, viewer);
  return listSuggestedUsers(input, { env, headers });
};

describe('listSuggestedUsers', () => {
  it('フォロー中の人がフォローしている人を、フォローしている人の数が多い順に返す', async () => {
    const v = await person('viewer');
    const a = await person('aoi');
    const b = await person('bob');
    const x = await person('xav');
    const y = await person('yui');
    await follow(v, a);
    await follow(v, b);
    await follow(a, x);
    await follow(a, y);
    await follow(b, y);
    const { items } = await call(v);
    expect(items.map((i) => [i.username, i.reason])).toEqual([
      ['yui', 'aoi さん他 1 人がフォロー中'],
      ['xav', 'aoi さんがフォロー中'],
    ]);
  });

  it('同じ数なら新しいアカウントが先', async () => {
    const v = await person('viewer');
    const a = await person('aoi');
    const old = await person('old', 1);
    const fresh = await person('fresh', 2);
    await follow(v, a);
    await follow(a, old);
    await follow(a, fresh);
    const { items } = await call(v);
    expect(items.slice(0, 2).map((i) => i.username)).toEqual(['fresh', 'old']);
    // equal created_at: the larger id first
    const p = await person('tie_p', 50);
    const q = await person('tie_q', 50);
    await follow(a, p);
    await follow(a, q);
    const tied = (await call(v)).items.filter((i) => i.username.startsWith('tie_'));
    const bigger = p.id > q.id ? p : q;
    expect(tied[0]!.username).toBe(bigger.username);
  });

  it('候補が 5 人に満たなければフォロワーの多い人で埋め、自分は入れない', async () => {
    const v = await person('viewer', 100);
    const three = await person('three', 1);
    const one = await person('one', 2);
    await person('zero_old', 3);
    await person('zero_new', 4);
    const oneB = await person('one_b', 5);
    await person('extra', 6);
    const f1 = await person('ff1');
    const f2 = await person('ff2');
    const f3 = await person('ff3');
    for (const f of [f1, f2, f3]) await follow(f, three);
    await follow(f1, one);
    await follow(f1, oneB);
    const { items } = await call(v);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.username)).toEqual(['three', 'one_b', 'one', 'extra', 'zero_new']);
    expect(items.every((i) => i.reason === 'おすすめ')).toBe(true);
    expect(items.map((i) => i.username)).not.toContain('viewer');
  });

  it('上限は 5 人で、フォロー中の人と自分は返さない', async () => {
    const v = await person('viewer');
    const a = await person('aoi');
    const followed = await person('already');
    await follow(v, a);
    await follow(v, followed);
    const names = ['cc1', 'cc2', 'cc3', 'cc4', 'cc5', 'cc6', 'cc7'];
    for (const [i, n] of names.entries()) await follow(a, await person(n, 10 + i));
    await follow(a, followed);
    await follow(a, v);
    const { items } = await call(v);
    expect(items.map((i) => i.username)).toEqual(['cc7', 'cc6', 'cc5', 'cc4', 'cc3']);

    // two candidates, then filled with the most followed
    const v2 = await person('viewer2');
    const a2 = await person('aoi2');
    await follow(v2, a2);
    await follow(a2, await person('dd1', 200));
    await follow(a2, await person('dd2', 201));
    const second = (await call(v2)).items;
    expect(second).toHaveLength(5);
    expect(second.slice(0, 2).map((i) => i.username)).toEqual(['dd2', 'dd1']);
    expect(second.slice(2).every((i) => i.reason === 'おすすめ')).toBe(true);
  });

  it('他に誰もいなければ空を返す', async () => {
    const v = await person('viewer');
    expect(await call(v)).toEqual({ items: [] });
  });

  it('ログインしていなければ UNAUTHENTICATED、余計な項目は VALIDATION', async () => {
    const v = await person('viewer');
    const env = { ...testAuthEnv(t.d1), ...storage };
    await expect(listSuggestedUsers({}, { env, headers: new Headers() })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    const err = await call(v, { userId: v.id }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('VALIDATION');
  });

  it('1 回の問い合わせで、束縛する値は 100 個以下', async () => {
    const v = await person('viewer');
    // Seeded with a few multi-row statements (ids are generated here, so literals are safe).
    const ids = Array.from({ length: 199 }, (_, i) => `crowd-${String(i).padStart(3, '0')}`);
    const userRows = ids.map(
      (id, i) =>
        `('${id}', 'u${String(i).padStart(3, '0')}', 'U ${i}', 'u${i}@example.com', ${BASE + i * 1000}, ${BASE + i * 1000})`,
    );
    await t.d1
      .prepare(
        `INSERT INTO users (id, username, display_name, email, created_at, updated_at) VALUES ${userRows.join(',')}`,
      )
      .run();
    const edges = new Set<string>();
    for (const id of ids.slice(0, 40)) edges.add(`'${v.id}', '${id}'`);
    for (let i = 0; edges.size < 2000; i += 1) {
      const a = ids[i % 199]!;
      const b = ids[(i * 7 + 3 + Math.floor(i / 199)) % 199]!;
      if (a !== b) edges.add(`'${a}', '${b}'`);
    }
    const edgeRows = [...edges].map((e, i) => `(${e}, ${BASE + i})`);
    for (let i = 0; i < edgeRows.length; i += 500) {
      await t.d1
        .prepare(
          `INSERT INTO follows (follower_id, followee_id, created_at) VALUES ${edgeRows.slice(i, i + 500).join(',')}`,
        )
        .run();
    }
    const prepared: string[] = [];
    const bound: number[] = [];
    const counting = new Proxy(t.d1 as object, {
      get(target, prop) {
        const value = Reflect.get(target, prop) as unknown;
        if (prop !== 'prepare') return typeof value === 'function' ? value.bind(target) : value;
        return (sql: string) => {
          prepared.push(sql);
          const stmt = (target as { prepare(s: string): object }).prepare(sql);
          return new Proxy(stmt, {
            get(s, p) {
              const m = Reflect.get(s, p) as unknown;
              if (p === 'bind') {
                return (...args: unknown[]) => {
                  bound.push(args.length);
                  return (m as (...a: unknown[]) => unknown).apply(s, args);
                };
              }
              return typeof m === 'function' ? m.bind(s) : m;
            },
          });
        };
      },
    });
    const plain = testAuthEnv(t.d1);
    const headers = await sessionHeadersFor(t.db, plain, v);
    const env = { ...plain, DB: counting as typeof plain.DB, ...storage };
    // the session lookup is better-auth's own read; only the suggestion query is counted below
    const before = prepared.length;
    const { items } = await listSuggestedUsers({}, { env, headers });
    expect(items).toHaveLength(5);
    const mine = prepared
      .slice(before)
      .filter((s) => /\bfrom "?follows"?/i.test(s) && /limit/i.test(s));
    expect(mine).toHaveLength(1);
    expect(Math.max(...bound)).toBeLessThanOrEqual(100);
  });
});
