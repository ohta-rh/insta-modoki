import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { createUser } from '../../../../tests/helpers/users';
import { listAdminPosts } from './list-admin-posts';

const t = useTestDb();

const setup = async (count: number) => {
  const env = testAuthEnv(t.d1);
  const admin = await createAdmin(t.db);
  const headers = await sessionHeadersFor(t.db, env, admin);
  const author = await createUser(t.db, { username: 'writer' });
  const base = Date.now() - 1_000_000;
  const ids: string[] = [];
  for (let i = 0; i < count; i++) {
    const caption = i === 0 ? 'あ'.repeat(80) : `caption ${i}`;
    const p = await createPost(t.db, author.id, {
      caption,
      createdAt: new Date(base + i * 1000),
      mediaCount: 0,
    });
    ids.push(p.id);
  }
  return { env, headers, ids };
};

describe('listAdminPosts', () => {
  it('20 件ちょうどで nextCursor が null、21 件で 20 件と 1 件', async () => {
    const { env, headers, ids } = await setup(20);
    const exact = await listAdminPosts({}, { env, headers });
    expect(exact.items).toHaveLength(20);
    expect(exact.nextCursor).toBeNull();
    // Newest first, and the row shape is fixed.
    expect(exact.items.map((i) => i.id)).toEqual([...ids].reverse());
    expect(exact.items[0]).toEqual({
      id: ids[19],
      authorUsername: 'writer',
      captionExcerpt: 'caption 19',
      createdAt: expect.any(Date),
    });
    expect(exact.items[19]!.captionExcerpt).toBe('あ'.repeat(50));

    const second = await createUser(t.db);
    const extra = await createPost(t.db, second.id, { caption: 'old', createdAt: new Date(1000) });
    const first = await listAdminPosts({}, { env, headers });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    const next = await listAdminPosts({ cursor: first.nextCursor }, { env, headers });
    expect(next.items.map((i) => i.id)).toEqual([extra.id]);
    expect(next.nextCursor).toBeNull();
  });

  it('壊れたカーソルと未知の入力は VALIDATION', async () => {
    const { env, headers } = await setup(1);
    for (const input of [{ cursor: '!!!' }, { cursor: 5 }, { extra: 1 }]) {
      const err = await listAdminPosts(input, { env, headers }).catch((e) => e);
      expect(err, JSON.stringify(input)).toMatchObject({ code: 'VALIDATION' });
    }
  });
});
