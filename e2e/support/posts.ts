import type { Page } from '@playwright/test';
import { userRow, withDb } from './db';
import { harness } from './harness';
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
  /** Epoch ms; default two hours ago. */
  createdAt?: number;
}): InsertedPost {
  const author = userRow(options.authorUsername);
  if (!author) throw new Error(`利用者がいません: ${options.authorUsername}`);
  const id = crypto.randomUUID();
  const count = options.mediaCount ?? 1;
  const storageKeys = Array.from(
    { length: count },
    () => `media/${author.id as string}/${crypto.randomUUID()}`,
  );
  harness({
    op: 'insertPost',
    id,
    authorId: author.id as string,
    caption: options.caption ?? '',
    createdAt: options.createdAt ?? Date.now() - 2 * 60 * 60 * 1000,
    media: storageKeys.map((storageKey, position) => ({
      id: crypto.randomUUID(),
      position,
      storageKey,
      width: options.width ?? 1200,
      height: options.height ?? 800,
      altText: options.altTexts?.[position] ?? '',
      thumbhash: THUMBHASH,
    })),
  });
  return { id, storageKeys };
}

/** The four stored files of one `media.storage_key`. */
export const fileKeysOf = (storageKey: string): string[] =>
  ['orig', 'w320', 'w640', 'w1080'].map((name) => `${storageKey}/${name}.webp`);

/** Stores real WebP files (made in the browser) for the four variants of every photo of the post. */
export async function putPostFiles(page: Page, post: InsertedPost): Promise<string[]> {
  const keys: string[] = [];
  for (const [i, storageKey] of post.storageKeys.entries()) {
    const body = await makeWebp(page, 64, 48, 40 + i * 70);
    for (const key of fileKeysOf(storageKey)) {
      await putObject(key, body);
      keys.push(key);
    }
  }
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

/** Holds every photo response for `delayMs` before it reaches the page (a slow connection). */
export async function delayMedia(page: Page, delayMs: number): Promise<void> {
  await page.route(/\/media\/[^/]+\/[^/]+\/(orig|w320|w640|w1080)\.webp$/, async (route) => {
    await new Promise((r) => setTimeout(r, delayMs));
    await route.continue();
  });
}

/** Tags an inserted post with `names` (normalized, as `createPost` stores them), at the post's time. */
export function tagPost(postId: string, names: string[], createdAt: number): void {
  harness({ op: 'tagPost', postId, names, createdAt });
}
