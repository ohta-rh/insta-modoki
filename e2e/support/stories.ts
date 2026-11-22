import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Page } from '@playwright/test';
import { userRow, withDb } from './db';
import { harness } from './harness';
import { putObject } from './storage';
import { makeWebp } from './posts';

const DAY = 86_400_000;

export type InsertedStory = { id: string; storageKey: string; type: 'image' | 'video' };

/** Inserts a story row for `authorUsername` directly (no upload, no createStory). */
export function insertStory(options: {
  authorUsername: string;
  type?: 'image' | 'video';
  /** Videos only; default 5,000. */
  durationMs?: number;
  altText?: string;
  /** Epoch ms; default two hours ago. */
  createdAt?: number;
  /** Epoch ms; default `createdAt` + 24 hours (the table allows no other value). */
  expiresAt?: number;
}): InsertedStory {
  const author = userRow(options.authorUsername);
  if (!author) throw new Error(`利用者がいません: ${options.authorUsername}`);
  const id = crypto.randomUUID();
  const type = options.type ?? 'image';
  const createdAt = options.createdAt ?? Date.now() - 2 * 60 * 60 * 1000;
  const storageKey = `stories/${author.id as string}/${crypto.randomUUID()}`;
  harness({
    op: 'insertStories',
    stories: [
      {
        id,
        authorId: author.id as string,
        type,
        storageKey,
        width: type === 'video' ? 320 : 1080,
        height: type === 'video' ? 568 : 1920,
        durationMs: type === 'video' ? (options.durationMs ?? 5000) : null,
        altText: options.altText ?? '',
        createdAt,
        expiresAt: options.expiresAt ?? createdAt + DAY,
      },
    ],
  });
  return { id, storageKey, type };
}

/** Records that `viewerUsername` has seen the story. */
export function insertStoryView(options: {
  storyId: string;
  viewerUsername: string;
  /** Epoch ms; default one hour ago. */
  createdAt?: number;
}): void {
  const viewer = userRow(options.viewerUsername);
  if (!viewer) throw new Error(`利用者がいません: ${options.viewerUsername}`);
  harness({
    op: 'insertStoryViews',
    views: [
      {
        storyId: options.storyId,
        viewerId: viewer.id as string,
        createdAt: options.createdAt ?? Date.now() - 60 * 60 * 1000,
      },
    ],
  });
}

/** The story rows of a user, oldest first. */
export function storyRows(username: string): Record<string, unknown>[] {
  const author = userRow(username);
  if (!author) return [];
  return withDb((db) =>
    db
      .prepare('SELECT * FROM stories WHERE author_id = ? ORDER BY created_at, id')
      .all(author.id as string),
  );
}

/** The e2e video materials (`e2e/fixtures/story-<n>s.mp4`). */
export const fixtureVideo = (seconds: 5 | 15 | 16): string =>
  join(process.cwd(), 'e2e/fixtures', `story-${seconds}s.mp4`);

/**
 * Stores the files a story's `storage_key` stands for: four real WebP files for a photo, one of
 * the fixture videos (as `video.mp4`) for a video. Returns the object keys.
 */
export async function putStoryFiles(
  page: Page,
  story: InsertedStory,
  seconds: 5 | 15 | 16 = 5,
): Promise<string[]> {
  if (story.type === 'video') {
    const key = `${story.storageKey}/video.mp4`;
    await putObject(key, new Uint8Array(readFileSync(fixtureVideo(seconds))), 'video/mp4');
    return [key];
  }
  const body = await makeWebp(page, 64, 114, 200);
  const keys = ['orig', 'w320', 'w640', 'w1080'].map((n) => `${story.storageKey}/${n}.webp`);
  for (const key of keys) await putObject(key, body);
  return keys;
}
