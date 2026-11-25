import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { createUser } from '../../../../tests/helpers/users';
import { backfillHashtags } from './backfill-hashtags';

const t = useTestDb();
const BASE = Date.UTC(2026, 10, 1);

const links = async () =>
  (
    await t.d1
      .prepare(
        'SELECT p.caption, h.name, ph.created_at FROM post_hashtags ph JOIN hashtags h ON h.id = ph.hashtag_id JOIN posts p ON p.id = ph.post_id',
      )
      .all<{ caption: string; name: string; created_at: number }>()
  ).results;

describe('backfillHashtags', () => {
  it('既存の投稿からタグを作り、2 回実行しても増えない', async () => {
    const author = await createUser(t.db);
    const thirtyOne = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    await createPost(t.db, author.id, {
      caption: '朝 #Tokyo #cafe',
      createdAt: new Date(BASE),
    });
    await createPost(t.db, author.id, { caption: thirtyOne, createdAt: new Date(BASE + 1000) });
    await createPost(t.db, author.id, {
      caption: `#${'a'.repeat(101)} #ok`,
      createdAt: new Date(BASE + 2000),
    });
    await createPost(t.db, author.id, { caption: 'タグなし', createdAt: new Date(BASE + 3000) });

    const first = await backfillHashtags(t.db, { batchSize: 2 });
    expect(first).toEqual({ posts: 4, links: 2 + 30 + 1 });
    const rows = await links();
    expect(rows).toHaveLength(33);
    expect(rows.filter((r) => r.caption === thirtyOne).map((r) => r.name)).not.toContain('t30');
    expect(rows.some((r) => r.name.length > 100)).toBe(false);
    expect(
      rows.find((r) => r.caption === '朝 #Tokyo #cafe' && r.name === 'tokyo')?.created_at,
    ).toBe(BASE);

    const second = await backfillHashtags(t.db, { batchSize: 2 });
    expect(second).toEqual({ posts: 4, links: 0 });
    expect(await links()).toHaveLength(33);
  });
});
