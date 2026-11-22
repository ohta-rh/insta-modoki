import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import type { StorageEnv } from '../../../shared/storage';
import { stories, storyViews } from '../db/schema';
import { markStoryViewed } from './mark-story-viewed';

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
const call = (s: Session, storyId: unknown, now = T + 1000) =>
  markStoryViewed({ storyId }, { env: s.env, headers: s.headers, now });
const rows = () => t.db.select().from(storyViews);

describe('markStoryViewed', () => {
  it('1 回目で行を作り、2 回目は増やさず、自分のストーリーでは作らず、期限切れは NOT_FOUND', async () => {
    const a = await signedIn();
    const b = await createUser(t.db);
    const theirs = await addStory(b.id);
    expect(await call(a, theirs)).toEqual({ viewed: true });
    expect(await rows()).toHaveLength(1);
    const [row] = await rows();
    expect(row).toMatchObject({ storyId: theirs, viewerId: a.user.id });
    expect(row!.createdAt.getTime()).toBe(T + 1000);
    expect(await call(a, theirs, T + 5000)).toEqual({ viewed: true });
    const after = await rows();
    expect(after).toHaveLength(1);
    expect(after[0]!.createdAt.getTime()).toBe(T + 1000);

    const mine = await addStory(a.user.id);
    expect(await call(a, mine)).toEqual({ viewed: true });
    expect(await rows()).toHaveLength(1);

    await expect(call(a, theirs, T + DAY)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(a, crypto.randomUUID())).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(a, 'not-a-uuid')).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(call(a, 42)).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('未ログインを UNAUTHENTICATED で拒む', async () => {
    const a = await signedIn();
    const id = await addStory(a.user.id);
    await expect(
      markStoryViewed({ storyId: id }, { env: a.env, headers: new Headers(), now: T }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });
});
