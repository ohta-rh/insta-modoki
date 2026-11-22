import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { follows } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { listStoryTray } from './list-story-tray';

const t = useTestDb();
let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const T = 1_700_000_000_000;
const DAY = 86_400_000;
let seq = 0;

async function signedIn() {
  const env = { ...testAuthEnv(t.d1), ...storage };
  const user = await createUser(t.db);
  return { env, user, headers: await sessionHeadersFor(t.db, env, user) };
}
type Session = Awaited<ReturnType<typeof signedIn>>;
const call = (s: Session, now = T + 1000) =>
  listStoryTray({}, { env: s.env, headers: s.headers, now });

async function follow(followerId: string, followeeId: string) {
  await t.db.insert(follows).values({ followerId, followeeId, createdAt: new Date(T) });
}
async function addStory(authorId: string, createdAt: number, expiresAt = createdAt + DAY) {
  const id = `story-${(seq += 1)}`;
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
    expiresAt: new Date(expiresAt),
  });
  return id;
}
async function view(storyId: string, viewerId: string) {
  await t.db.insert(storyViews).values({ storyId, viewerId, createdAt: new Date(T) });
}

describe('listStoryTray', () => {
  it('フォロー中でストーリーのある人だけを返す', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    const d = await createUser(t.db);
    await follow(a.user.id, b.id);
    await follow(a.user.id, c.id);
    await addStory(b.id, T);
    await addStory(d.id, T);
    const tray = await call(a);
    expect(tray.items.map((i) => i.user.username)).toEqual([b.username]);
    expect(tray.items[0]).toMatchObject({ hasUnseen: true, latestAt: new Date(T).toISOString() });
    expect(tray.items[0]!.user).toEqual({
      username: b.username,
      displayName: b.displayName,
      avatarUrl: null,
    });
  });

  it('expires_at の 1 ms 前は出し、ちょうどは出さない', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    await follow(a.user.id, b.id);
    await addStory(b.id, T);
    expect((await call(a, T + DAY - 1)).items.map((i) => i.user.username)).toEqual([b.username]);
    expect((await call(a, T + DAY)).items).toEqual([]);
  });

  it('全て見た人は既読で後ろに並び、新しいストーリーで未読に戻る', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const c = await createUser(t.db);
    await follow(a.user.id, b.id);
    await follow(a.user.id, c.id);
    const b1 = await addStory(b.id, T + 5000);
    await addStory(c.id, T);
    await view(b1, a.user.id);
    const first = await call(a, T + 10_000);
    expect(first.items.map((i) => [i.user.username, i.hasUnseen])).toEqual([
      [c.username, true],
      [b.username, false],
    ]);
    await addStory(b.id, T + 6000);
    const second = await call(a, T + 10_000);
    expect(second.items.find((i) => i.user.username === b.username)!.hasUnseen).toBe(true);
  });

  it('51 人のときは 50 人まで返し、50 人のときは 50 人返す', async () => {
    const a = await signedIn();
    for (let i = 0; i < 51; i++) {
      const u = await createUser(t.db);
      await follow(a.user.id, u.id);
      await addStory(u.id, T + i);
    }
    expect((await call(a)).items).toHaveLength(50);
    const e = await signedIn();
    for (let i = 0; i < 50; i++) {
      const u = await createUser(t.db);
      await follow(e.user.id, u.id);
      await addStory(u.id, T + i);
    }
    expect((await call(e)).items).toHaveLength(50);
  });

  it('自分のストーリーは items に入れず hasOwn で返す', async () => {
    const a = await signedIn();
    const none = await call(a);
    expect(none.hasOwn).toBe(false);
    expect(none.me.username).toBe(a.user.username);
    await addStory(a.user.id, T);
    const tray = await call(a);
    expect(tray.hasOwn).toBe(true);
    expect(tray.me.username).toBe(a.user.username);
    expect(tray.items).toEqual([]);
  });

  it('未ログインを UNAUTHENTICATED で拒み、応答に内部の列を含めない', async () => {
    const a = await signedIn();
    await expect(
      listStoryTray({}, { env: a.env, headers: new Headers(), now: T }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    const b = await createUser(t.db);
    await follow(a.user.id, b.id);
    await addStory(b.id, T);
    await addStory(a.user.id, T);
    const json = JSON.stringify(await call(a));
    for (const word of ['email', 'storage_key', 'storageKey', 'avatarKey', 'viewer_id']) {
      expect(json).not.toContain(word);
    }
  });
});
