import { beforeAll, describe, expect, it } from 'vitest';
import { useTestDb } from '../../../../tests/helpers/db';
import { createComment, createLike, createPost } from '../../../../tests/helpers/posts';
import { sessionHeadersFor, testAuthEnv } from '../../../../tests/helpers/session';
import { loadStorageEnv } from '../../../../tests/helpers/storage';
import { createUser } from '../../../../tests/helpers/users';
import { posts, users } from '../../../shared/db/schema';
import { eq } from 'drizzle-orm';
import type { StorageEnv } from '../../../shared/storage';
import { getPost } from './get-post';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const env = () => ({ ...testAuthEnv(t.d1), ...storage });

describe('getPost', () => {
  it('存在しない postId のとき NOT_FOUND を返す', async () => {
    const e = env();
    for (const postId of [crypto.randomUUID(), 'abc', '', '../x', 7, undefined]) {
      const err = await getPost({ postId }, { env: e, headers: new Headers() }).catch((x) => x);
      expect(err, String(postId)).toMatchObject({
        code: 'NOT_FOUND',
        message: 'ページが見つかりません',
      });
    }
  });

  it('PostView が許可された項目だけを返し likedByMe が正しい', async () => {
    const e = env();
    const author = await createUser(t.db, { displayName: '作者' });
    await t.db
      .update(users)
      .set({ avatarKey: `media/${author.id}/avatar1` })
      .where(eq(users.id, author.id));
    const viewer = await createUser(t.db);
    const stranger = await createUser(t.db);
    const post = await createPost(t.db, author.id, {
      caption: 'こんにちは "引用" <b>',
      mediaCount: 3,
      altText: '猫',
      width: 1600,
      height: 900,
    });
    await t.db.update(posts).set({ likeCount: 2, commentCount: 1 }).where(eq(posts.id, post.id));
    await createLike(t.db, viewer.id, post.id);
    await createLike(t.db, author.id, post.id);
    await createComment(t.db, post.id, viewer.id);

    const viaViewer = await getPost(
      { postId: post.id },
      { env: e, headers: await sessionHeadersFor(t.db, e, viewer) },
    );
    expect(Object.keys(viaViewer).sort()).toEqual(
      [
        'author',
        'caption',
        'commentCount',
        'createdAt',
        'id',
        'likeCount',
        'likedByMe',
        'media',
      ].sort(),
    );
    expect(Object.keys(viaViewer.author).sort()).toEqual(['avatarUrl', 'displayName', 'username']);
    expect(viaViewer).toMatchObject({
      id: post.id,
      caption: 'こんにちは "引用" <b>',
      likeCount: 2,
      commentCount: 1,
      likedByMe: true,
      author: { username: author.username, displayName: '作者' },
    });
    expect(viaViewer.author.avatarUrl).toBe(
      `${storage.S3_PUBLIC_BASE_URL ?? `${storage.S3_ENDPOINT}/${storage.S3_BUCKET}`}/media/${author.id}/avatar1/w320.webp`,
    );
    expect(new Date(viaViewer.createdAt).toISOString()).toBe(viaViewer.createdAt);
    expect(viaViewer.media.map((m) => m.srcset.w320)).toEqual(
      post.media.map((m) => expect.stringContaining(`${m.storageKey}/w320.webp`)),
    );
    expect(viaViewer.media[0]).toMatchObject({
      type: 'image',
      width: 1600,
      height: 900,
      altText: '猫',
    });
    expect(Object.keys(viaViewer.media[0]!).sort()).toEqual([
      'altText',
      'height',
      'srcset',
      'thumbhash',
      'type',
      'width',
    ]);
    expect(viaViewer.media[1]!.srcset.w1080).toContain(`${post.media[1]!.storageKey}/w1080.webp`);

    // The payload carries nothing private: no email, role, id of the author or storage key field.
    const json = JSON.stringify(viaViewer);
    expect(json).not.toContain('@example.com');
    expect(json).not.toContain('"role"');
    expect(json).not.toContain('"storageKey"');
    expect(json).not.toContain('"email"');

    const viaStranger = await getPost(
      { postId: post.id },
      { env: e, headers: await sessionHeadersFor(t.db, e, stranger) },
    );
    expect(viaStranger.likedByMe).toBe(false);
    const anonymous = await getPost({ postId: post.id }, { env: e, headers: new Headers() });
    expect(anonymous.likedByMe).toBe(false);
    expect(anonymous.author.avatarUrl).toBe(viaViewer.author.avatarUrl);
  });

  it('写真を position の昇順で返し アバターが無い作者の avatarUrl は null になる', async () => {
    const e = env();
    const author = await createUser(t.db);
    const post = await createPost(t.db, author.id, { mediaCount: 3 });
    const view = await getPost({ postId: post.id }, { env: e, headers: new Headers() });
    expect(view.author.avatarUrl).toBeNull();
    expect(view.media.map((m) => m.srcset.w640)).toEqual(
      post.media.map((m) => expect.stringContaining(m.storageKey)),
    );
  });
});
