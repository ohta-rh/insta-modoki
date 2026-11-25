import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createAdmin } from '../../../../tests/helpers/invites';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { adminActions, posts } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';

// A second administrator's delete of the same post lands between adminDeletePost's lookup and
// its batch: `rival` runs once, in front of the first `removePost` call.
let rival: (() => Promise<unknown>) | null = null;
vi.mock('../../post', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../post')>();
  return {
    ...actual,
    removePost: async (...args: Parameters<typeof actual.removePost>) => {
      const run = rival;
      rival = null;
      await run?.();
      return actual.removePost(...args);
    },
  };
});
import { adminDeletePost } from './admin-delete-post';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

describe('adminDeletePost', () => {
  it('同じ投稿を同時に消す別の削除と競合しても admin_actions は 1 行だけ', async () => {
    const env = { ...testAuthEnv(t.d1), ...storage };
    const admin = await createAdmin(t.db);
    const headers = await sessionHeadersFor(t.db, env, admin);
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id, { mediaCount: 1 });

    rival = () => adminDeletePost({ postId: post.id }, { env, headers });
    expect(await adminDeletePost({ postId: post.id }, { env, headers })).toEqual({ deleted: true });

    expect(await t.db.select().from(posts)).toHaveLength(0);
    const rows = await t.db.select().from(adminActions);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: 'delete_post', targetId: post.id });
  });
});
