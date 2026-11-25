import { describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createUser } from '../../../../tests/helpers/users';
import { follows } from '../../../shared/db/schema';
import { findActiveStories, findSeenStoryIds } from './queries';
import { stories, storyViews } from './schema';

const t = useTestDb();
const T = 1_700_000_000_000;
const DAY = 86_400_000;

async function addStory(authorId: string, id: string, createdAt: number) {
  await t.db.insert(stories).values({
    id,
    authorId,
    type: 'image',
    storageKey: `stories/${authorId}/${id}`,
    width: 100,
    height: 200,
    durationMs: null,
    altText: '',
    createdAt: new Date(createdAt),
    expiresAt: new Date(createdAt + DAY),
  });
}

describe('findActiveStories / findSeenStoryIds', () => {
  it('expires_at の 1 ms 前は返し、expires_at ちょうどは返さない', async () => {
    const a = await createUser(t.db);
    const v = await createUser(t.db);
    await addStory(a.id, 's1', T);
    await t.db.insert(storyViews).values({ storyId: 's1', viewerId: v.id, createdAt: new Date(T) });

    const before = T + DAY - 1;
    expect((await findActiveStories(t.db, { authors: { ids: [a.id] }, now: before })).length).toBe(
      1,
    );
    expect((await findSeenStoryIds(t.db, { viewerId: v.id, now: before })).has('s1')).toBe(true);

    const at = T + DAY;
    expect(await findActiveStories(t.db, { authors: { ids: [a.id] }, now: at })).toEqual([]);
    expect((await findSeenStoryIds(t.db, { viewerId: v.id, now: at })).size).toBe(0);
  });

  it('古い順に 投稿者の表示名とあわせて返し 他の利用者の行は返さない', async () => {
    const a = await createUser(t.db);
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    await addStory(a.id, 's2', T + 2000);
    await addStory(a.id, 's1', T + 1000);
    await addStory(b.id, 's3', T);
    await addStory(c.id, 's4', T);
    const rows = await findActiveStories(t.db, { authors: { ids: [a.id, b.id] }, now: T + 5000 });
    expect(rows.map((r) => r.id)).toEqual(['s3', 's1', 's2']);
    expect(rows[1]).toMatchObject({
      authorId: a.id,
      username: a.username,
      displayName: a.displayName,
      avatarKey: null,
      type: 'image',
      storageKey: `stories/${a.id}/s1`,
    });
    expect(rows[1]!.createdAt).toEqual(new Date(T + 1000));
  });

  it('followedBy はフォロー中の人のものだけを返し 自分のものや他人のものは返さない', async () => {
    const me = await createUser(t.db);
    const friend = await createUser(t.db);
    const stranger = await createUser(t.db);
    await t.db.insert(follows).values({
      followerId: me.id,
      followeeId: friend.id,
      createdAt: new Date(T),
    });
    await addStory(me.id, 'mine', T);
    await addStory(friend.id, 'friend', T);
    await addStory(stranger.id, 'stranger', T);
    const rows = await findActiveStories(t.db, { authors: { followedBy: me.id }, now: T + 1 });
    expect(rows.map((r) => r.id)).toEqual(['friend']);
  });

  it('ids は 90 件まで受け付け 91 件目で投げる 空も投げる', async () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `u${i}`);
    expect(await findActiveStories(t.db, { authors: { ids: ids(90) }, now: T })).toEqual([]);
    await expect(findActiveStories(t.db, { authors: { ids: ids(91) }, now: T })).rejects.toThrow();
    await expect(findActiveStories(t.db, { authors: { ids: [] }, now: T })).rejects.toThrow();
  });

  it('既読は自分の行だけを数える', async () => {
    const a = await createUser(t.db);
    const v = await createUser(t.db);
    const w = await createUser(t.db);
    await addStory(a.id, 's1', T);
    await addStory(a.id, 's2', T);
    await t.db.insert(storyViews).values([
      { storyId: 's1', viewerId: v.id, createdAt: new Date(T) },
      { storyId: 's2', viewerId: w.id, createdAt: new Date(T) },
    ]);
    expect([...(await findSeenStoryIds(t.db, { viewerId: v.id, now: T + 1 }))]).toEqual(['s1']);
  });
});
