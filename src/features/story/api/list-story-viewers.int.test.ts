import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import type { StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { listStoryViewers } from './list-story-viewers';

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
async function addStory(authorId: string) {
  const id = crypto.randomUUID();
  await t.db.insert(stories).values({
    id,
    authorId,
    type: 'image',
    storageKey: `stories/${authorId}/${id}`,
    width: 100,
    height: 200,
    durationMs: null,
    altText: '',
    createdAt: new Date(T),
    expiresAt: new Date(T + DAY),
  });
  return id;
}
async function addViewers(storyId: string, count: number) {
  const viewers = [];
  for (let i = 0; i < count; i++) {
    const v = await createUser(t.db);
    await t.db.insert(storyViews).values({ storyId, viewerId: v.id, createdAt: new Date(T + i) });
    viewers.push(v);
  }
  return viewers;
}
const call = (s: Session, input: unknown, now = T + 1000) =>
  listStoryViewers(input, { env: s.env, headers: s.headers, now });

describe('listStoryViewers', () => {
  it('投稿者だけが閲覧者を読め、他人は FORBIDDEN になる', async () => {
    const owner = await signedIn();
    const other = await signedIn();
    const id = await addStory(owner.user.id);
    const [v] = await addViewers(id, 1);
    const page = await call(owner, { storyId: id });
    expect(page.items).toEqual([
      { username: v!.username, displayName: v!.displayName, avatarUrl: null },
    ]);
    expect(page.nextCursor).toBeNull();
    await expect(call(other, { storyId: id })).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: 'この操作はできません',
    });
    await expect(
      listStoryViewers({ storyId: id }, { env: owner.env, headers: new Headers(), now: T }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(call(owner, { storyId: crypto.randomUUID() })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(call(owner, { storyId: 'nope' })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(owner, { storyId: id }, T + DAY)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('21 人を 20 人と 1 人に分け、20 人ちょうどは 1 ページで、壊れたカーソルを VALIDATION で拒む', async () => {
    const owner = await signedIn();
    const id = await addStory(owner.user.id);
    const viewers = await addViewers(id, 21);
    const first = await call(owner, { storyId: id });
    expect(first.items).toHaveLength(20);
    expect(first.nextCursor).not.toBeNull();
    // newest first: the last inserted viewer leads
    expect(first.items[0]!.username).toBe(viewers[20]!.username);
    const second = await call(owner, { storyId: id, cursor: first.nextCursor! });
    expect(second.items.map((i) => i.username)).toEqual([viewers[0]!.username]);
    expect(second.nextCursor).toBeNull();

    const exact = await addStory(owner.user.id);
    await addViewers(exact, 20);
    const one = await call(owner, { storyId: exact });
    expect(one.items).toHaveLength(20);
    expect(one.nextCursor).toBeNull();

    await expect(call(owner, { storyId: id, cursor: '!!!' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await expect(call(owner, { storyId: id, cursor: 7 })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });
});
