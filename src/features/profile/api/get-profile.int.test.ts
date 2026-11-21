import { beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { useTestDb } from '../../../../tests/helpers/db';
import { createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { follows, users } from '../../../shared/db/schema';
import type { StorageEnv } from '../../../shared/storage';
import { getProfile } from './get-profile';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });
const follow = (followerId: string, followeeId: string) =>
  t.db.insert(follows).values({ followerId, followeeId, createdAt: new Date() });

describe('getProfile', () => {
  it('存在しない username のとき NOT_FOUND を返す', async () => {
    const e = env();
    for (const username of ['nobody_here', '.abc', 'ab', '', 'accounts', 7, undefined]) {
      const err = await getProfile({ username }, { env: e, headers: new Headers() }).catch(
        (x) => x,
      );
      expect(err, String(username)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
  });

  it('大文字小文字が違っても同じプロフィールを返す', async () => {
    const e = env();
    const user = await createUser(t.db, { username: 'haru_prof', displayName: 'ハル' });
    const view = await getProfile({ username: 'HARU_Prof' }, { env: e, headers: new Headers() });
    expect(view).toMatchObject({ username: user.username, displayName: 'ハル' });
  });

  it('ProfileView が許可された項目だけを返し isMe と isFollowing が正しい', async () => {
    const e = env();
    const target = await createUser(t.db, { displayName: '対象' });
    await t.db
      .update(users)
      .set({ bio: '自己紹介です', avatarKey: `media/${target.id}/avatar1` })
      .where(eq(users.id, target.id));
    const viewer = await createUser(t.db);
    const stranger = await createUser(t.db);
    const third = await createUser(t.db);
    await createPost(t.db, target.id);
    await createPost(t.db, target.id, { mediaCount: 2 });
    await createPost(t.db, stranger.id);
    await follow(viewer.id, target.id);
    await follow(third.id, target.id);
    await follow(target.id, third.id);
    await follow(target.id, stranger.id);
    await follow(target.id, viewer.id);

    const asViewer = await getProfile(
      { username: target.username },
      { env: e, headers: await sessionHeadersFor(t.db, e, viewer) },
    );
    expect(Object.keys(asViewer).sort()).toEqual(
      [
        'avatarUrl',
        'bio',
        'displayName',
        'followerCount',
        'followingCount',
        'isFollowing',
        'isMe',
        'postCount',
        'username',
      ].sort(),
    );
    expect(asViewer).toMatchObject({
      username: target.username,
      displayName: '対象',
      bio: '自己紹介です',
      postCount: 2,
      followerCount: 2,
      followingCount: 3,
      isMe: false,
      isFollowing: true,
    });
    expect(asViewer.avatarUrl).toBe(
      `${storage.S3_PUBLIC_BASE_URL ?? `${storage.S3_ENDPOINT}/${storage.S3_BUCKET}`}/media/${target.id}/avatar1/w320.webp`,
    );
    const json = JSON.stringify(asViewer);
    // No private column, and no storage key field (the avatar URL is the only storage path).
    for (const secret of ['@example.com', '"email"', '"role"', '"password"', 'avatarKey']) {
      expect(json).not.toContain(secret);
    }

    const asStranger = await getProfile(
      { username: target.username },
      { env: e, headers: await sessionHeadersFor(t.db, e, stranger) },
    );
    expect(asStranger).toMatchObject({ isMe: false, isFollowing: false });
    const asSelf = await getProfile(
      { username: target.username },
      { env: e, headers: await sessionHeadersFor(t.db, e, target) },
    );
    expect(asSelf).toMatchObject({ isMe: true, isFollowing: false });
    const anonymous = await getProfile(
      { username: target.username },
      { env: e, headers: new Headers() },
    );
    expect(anonymous).toMatchObject({ isMe: false, isFollowing: false, postCount: 2 });
  });

  it('アイコンが無い利用者の avatarUrl は null で投稿 0 件のとき数は 0 になる', async () => {
    const e = env();
    const user = await createUser(t.db);
    const view = await getProfile({ username: user.username }, { env: e, headers: new Headers() });
    expect(view).toMatchObject({
      avatarUrl: null,
      bio: '',
      postCount: 0,
      followerCount: 0,
      followingCount: 0,
    });
  });
});
