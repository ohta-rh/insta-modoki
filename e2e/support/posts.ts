import type { Page } from '@playwright/test';
import { userRow, withDb } from './db';
import { putObject } from './storage';

const THUMBHASH = 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==';

export type InsertedPost = { id: string; storageKeys: string[] };

/** Inserts a post and its media rows for `authorUsername` directly (no upload, no createPost). */
export function insertPost(options: {
  authorUsername: string;
  caption?: string;
  mediaCount?: number;
  width?: number;
  height?: number;
  altTexts?: string[];
}): InsertedPost {
  const author = userRow(options.authorUsername);
  if (!author) throw new Error(`利用者がいません: ${options.authorUsername}`);
  const id = crypto.randomUUID();
  const count = options.mediaCount ?? 1;
  const storageKeys = Array.from(
    { length: count },
    () => `media/${author.id as string}/${crypto.randomUUID()}`,
  );
  withDb((db) => {
    db.prepare('INSERT INTO posts (id, author_id, caption, created_at) VALUES (?, ?, ?, ?)').run(
      id,
      author.id as string,
      options.caption ?? '',
      Date.now() - 2 * 60 * 60 * 1000,
    );
    storageKeys.forEach((key, position) => {
      db.prepare(
        'INSERT INTO media (id, post_id, position, type, storage_key, width, height, alt_text, thumbhash) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      ).run(
        crypto.randomUUID(),
        id,
        position,
        'image',
        key,
        options.width ?? 1200,
        options.height ?? 800,
        options.altTexts?.[position] ?? '',
        THUMBHASH,
      );
    });
  });
  return { id, storageKeys };
}

/** The four stored files of one `media.storage_key`. */
export const fileKeysOf = (storageKey: string): string[] =>
  ['orig', 'w320', 'w640', 'w1080'].map((name) => `${storageKey}/${name}.webp`);

/** Stores the four files of every photo of the post, so a delete has something to remove. */
export async function putPostFiles(post: InsertedPost): Promise<string[]> {
  const keys = post.storageKeys.flatMap(fileKeysOf);
  for (const key of keys) await putObject(key);
  return keys;
}

export function postRowCount(id: string): number {
  return withDb(
    (db) => (db.prepare('SELECT count(*) AS n FROM posts WHERE id = ?').get(id) as { n: number }).n,
  );
}

/** A WebP made by the browser's own encoder, `width` x `height`, filled with one hue. */
export async function makeWebp(page: Page, width: number, height: number, hue: number) {
  const base64 = await page.evaluate(
    async ([w, h, hu]) => {
      const canvas = document.createElement('canvas');
      canvas.width = w!;
      canvas.height = h!;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = `hsl(${hu}, 70%, 55%)`;
      ctx.fillRect(0, 0, w!, h!);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/webp', 0.8),
      );
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let s = '';
      for (const b of bytes) s += String.fromCharCode(b);
      return btoa(s);
    },
    [width, height, hue],
  );
  return Buffer.from(base64, 'base64');
}

/**
 * The local object store refuses anonymous reads, so the browser cannot load a photo from it. The
 * photos of a post are answered here instead, after `delayMs` (0 = at once). Returns the number
 * of photo requests seen so far.
 */
export async function serveMedia(page: Page, delayMs = 0): Promise<() => number> {
  const body = await makeWebp(page, 64, 48, 200);
  let seen = 0;
  await page.route(/\/media\/[^/]+\/[^/]+\/(orig|w320|w640|w1080)\.webp$/, async (route) => {
    seen += 1;
    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
    await route.fulfill({ status: 200, contentType: 'image/webp', body });
  });
  return () => seen;
}
