import { newId } from '../../src/shared/db/id';
import { bookmarks, comments, likes, media, posts } from '../../src/shared/db/schema';
import type { Db } from '../../src/shared/db/client';

export type TestMedia = { id: string; storageKey: string; position: number };
export type TestPost = { id: string; authorId: string; media: TestMedia[] };

export type CreatePostOptions = {
  caption?: string;
  /** How many photos (default 1). */
  mediaCount?: number;
  createdAt?: Date;
  width?: number;
  height?: number;
  altText?: string;
};

/** Inserts a post and its media rows directly (the storage objects are not created). */
export async function createPost(
  db: Db,
  authorId: string,
  options: CreatePostOptions = {},
): Promise<TestPost> {
  const id = newId();
  const count = options.mediaCount ?? 1;
  await db.insert(posts).values({
    id,
    authorId,
    caption: options.caption ?? '',
    createdAt: options.createdAt ?? new Date(),
  });
  const rows: TestMedia[] = Array.from({ length: count }, (_, position) => ({
    id: newId(),
    storageKey: `media/${authorId}/${newId()}`,
    position,
  }));
  if (rows.length > 0) {
    await db.insert(media).values(
      rows.map((m) => ({
        id: m.id,
        postId: id,
        position: m.position,
        type: 'image' as const,
        storageKey: m.storageKey,
        width: options.width ?? 1200,
        height: options.height ?? 800,
        altText: options.altText ?? '',
        thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
      })),
    );
  }
  return { id, authorId, media: rows };
}

export async function createLike(db: Db, userId: string, postId: string): Promise<void> {
  await db.insert(likes).values({ userId, postId, createdAt: new Date() });
}

/** Saves a post for a user at an exact time (the bookmark slice's tests). */
export async function createBookmark(
  db: Db,
  userId: string,
  postId: string,
  createdAt: Date = new Date(),
): Promise<void> {
  await db.insert(bookmarks).values({ userId, postId, createdAt });
}

export async function createComment(
  db: Db,
  postId: string,
  authorId: string,
  body = 'こんにちは',
): Promise<string> {
  const id = newId();
  await db.insert(comments).values({ id, postId, authorId, body, createdAt: new Date() });
  return id;
}

/** Inserts a comment (or a reply, with `parentId`) at an exact time, without touching `comment_count`. */
export async function createCommentAt(
  db: Db,
  postId: string,
  authorId: string,
  options: { parentId?: string; body?: string; createdAt: Date },
): Promise<string> {
  const id = newId();
  await db.insert(comments).values({
    id,
    postId,
    authorId,
    parentId: options.parentId ?? null,
    body: options.body ?? 'こんにちは',
    createdAt: options.createdAt,
  });
  return id;
}

/** The four stored files of one `media.storage_key`. */
export const fileKeysOf = (storageKey: string): string[] =>
  ['orig', 'w320', 'w640', 'w1080'].map((name) => `${storageKey}/${name}.webp`);
