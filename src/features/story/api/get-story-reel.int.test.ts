import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { follows } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { getStoryReel } from './get-story-reel';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const T = 1_700_000_000_000;
const DAY = 86_400_000;

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;
const call = (s: Session, username: string, now = T + 1000) =>
  getStoryReel({ username }, { env: s.env, headers: s.headers, now });

async function follow(followerId: string, followeeId: string) {
  await t.db.insert(follows).values({ followerId, followeeId, createdAt: new Date(T) });
}
async function addStory(
  authorId: string,
  createdAt: number,
  o: { expiresAt?: number; type?: 'image' | 'video'; altText?: string } = {},
) {
  const id = crypto.randomUUID();
  const type = o.type ?? 'image';
  await t.db.insert(stories).values({
    id,
    authorId,
    type,
    storageKey: `stories/${authorId}/${id}`,
    width: 100,
    height: 200,
    durationMs: type === 'video' ? 8000 : null,
    altText: o.altText ?? '',
    createdAt: new Date(createdAt),
    expiresAt: new Date(o.expiresAt ?? createdAt + DAY),
  });
  return id;
}
async function view(storyId: string, viewerId: string) {
  await t.db.insert(storyViews).values({ storyId, viewerId, createdAt: new Date(T) });
}

describe('getStoryReel', () => {
  it('古い順の 3 件と、最初の未読の位置と、次の人を返す', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    await follow(a.user.id, b.id);
    await follow(a.user.id, c.id);
    // newest story first in the tray: b (T+300) before c (T+100)
    const b2 = await addStory(b.id, T + 200, { type: 'video', altText: '二つ目' });
    const b1 = await addStory(b.id, T + 100);
    const b3 = await addStory(b.id, T + 300);
    await addStory(c.id, T + 50);
    await view(b1, a.user.id);

    const reel = await call(a, b.username);
    expect(reel.stories.map((s) => s.id)).toEqual([b1, b2, b3]);
    expect(reel.startIndex).toBe(1);
    expect(reel.isMe).toBe(false);
    expect(reel.stories.map((s) => s.viewerCount)).toEqual([null, null, null]);
    expect(reel.nextUsername).toBe(c.username);
    expect(reel.user).toEqual({
      username: b.username,
      displayName: b.displayName,
      avatarUrl: null,
    });
    expect(reel.stories[1]).toMatchObject({
      type: 'video',
      durationMs: 8000,
      altText: '二つ目',
      srcset: null,
    });
    expect(reel.stories[1]!.videoUrl).toMatch(/\/video\.mp4$/);
    expect(reel.stories[0]!.videoUrl).toBeNull();
    expect(reel.stories[0]!.srcset!.w320).toMatch(/\/w320\.webp$/);
    const json = JSON.stringify(reel);
    for (const word of ['storage_key', 'storageKey', 'email']) expect(json).not.toContain(word);

    // the last in the tray has no next person
    expect((await call(a, c.username)).nextUsername).toBeNull();
    // all seen: start at 0
    await view(b2, a.user.id);
    await view(b3, a.user.id);
    expect((await call(a, b.username)).startIndex).toBe(0);
  });

  it('全件を見終えた人は次の人にしない', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    await follow(a.user.id, b.id);
    await follow(a.user.id, c.id);
    const b1 = await addStory(b.id, T + 300);
    await addStory(c.id, T + 100);
    await view(b1, a.user.id);
    // the tray is now [c, b]; b has nothing unseen, so c has no next person
    expect((await call(a, c.username)).nextUsername).toBeNull();
  });

  it('未視聴が残っている人は次の人になる', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    const d = await createUser(t.db);
    for (const u of [b, c, d]) await follow(a.user.id, u.id);
    const b1 = await addStory(b.id, T + 400);
    await addStory(c.id, T + 300);
    await addStory(d.id, T + 100);
    await view(b1, a.user.id);
    // the tray is [c, d, b]: after c comes d (unseen), and after d nobody (b is seen)
    expect((await call(a, c.username)).nextUsername).toBe(d.username);
    expect((await call(a, d.username)).nextUsername).toBeNull();
  });

  it('自分のストーリーは先頭から始まり、閲覧者の数を返し、次は並びの先頭', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const v = await createUser(t.db);
    await follow(a.user.id, b.id);
    await addStory(b.id, T);
    const mine = await addStory(a.user.id, T + 10);
    await addStory(a.user.id, T + 20);
    await view(mine, b.id);
    await view(mine, v.id);
    const reel = await call(a, a.user.username.toUpperCase());
    expect(reel.isMe).toBe(true);
    expect(reel.startIndex).toBe(0);
    expect(reel.stories.map((s) => s.viewerCount)).toEqual([2, 0]);
    expect(reel.nextUsername).toBe(b.username);
  });

  it('期限切れだけの人と存在しない人は NOT_FOUND で、expires_at の 1 ms 前は返す', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    await addStory(b.id, T);
    expect((await call(a, b.username, T + DAY - 1)).stories).toHaveLength(1);
    await expect(call(a, b.username, T + DAY)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      message: 'ページが見つかりません',
    });
    await expect(call(a, 'no_such_user_x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(a, '')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(a, 'x'.repeat(31))).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const a = await signedIn();
    await expect(
      getStoryReel({ username: 'x' }, { env: a.env, headers: new Headers(), now: T }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
