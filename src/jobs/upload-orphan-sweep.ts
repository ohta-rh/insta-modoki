import { getStorageClient } from '../shared/storage/client.ts';
import { listObjects as listStorageObjects } from '../shared/storage/list.ts';
import { removeObjects as removeStorageObjects } from '../shared/storage/remove.ts';
import type { Job, JobContext } from './types.ts';

/** A file is kept for this long after it was stored: the upload and its registration are minutes apart. */
export const UPLOAD_GRACE_MS = 86_400_000;
export const SWEEP_PREFIXES = ['media/', 'stories/'] as const;
/** Keys per listing request (S3 returns at most 1,000). */
export const SWEEP_PAGE_SIZE = 1000;
/** Listing pages per prefix per run: 4 listings + 4 deletes per prefix keep a run inside the free plan. */
export const SWEEP_MAX_PAGES = 4;

const CURSOR_NAME = 'upload-orphan-sweep:';

/** True only when the file is strictly more than 24 hours old at `now`. */
export function isPastGrace(lastModified: number, now: number): boolean {
  return now - lastModified > UPLOAD_GRACE_MS;
}

/**
 * The row-side key of a stored file: `<media|stories>/<id>/<id>/<file>` gives everything before
 * the last `/`; any other shape gives null and is never deleted.
 */
export function baseKeyOf(key: string): string | null {
  return /^(?:media|stories)\/[^/\n]+\/[^/\n]+\/[^/\n]+$/.test(key)
    ? key.slice(0, key.lastIndexOf('/'))
    : null;
}

const READ_CURSORS =
  'SELECT name, last_key FROM job_cursors WHERE name IN (SELECT value FROM json_each(?1))';
// Of the candidate bases (one JSON array), the ones some row still points at.
const REFERENCED =
  'SELECT j.value AS base FROM json_each(?1) AS j WHERE EXISTS (SELECT 1 FROM media WHERE storage_key = j.value) OR EXISTS (SELECT 1 FROM stories WHERE storage_key = j.value) OR j.value IN (SELECT avatar_key FROM users WHERE avatar_key IS NOT NULL)';
const WRITE_CURSORS =
  "INSERT INTO job_cursors (name, last_key, updated_at) SELECT json_extract(value, '$[0]'), json_extract(value, '$[1]'), ?2 FROM json_each(?1) WHERE true ON CONFLICT (name) DO UPDATE SET last_key = excluded.last_key, updated_at = excluded.updated_at";

/**
 * Deletes files under `media/` and `stories/` that were stored more than 24 hours before `ctx.now`
 * and that no row references (`media.storage_key`, `stories.storage_key`, `users.avatar_key`).
 * Each prefix is listed from where the last run stopped (`job_cursors`), at most `maxPages` pages
 * of `pageSize` keys; a file that cannot be deleted stays and is found again on the next lap.
 * Listing and D1 errors are thrown unchanged, before the cursors are written.
 */
export async function sweepUnreferencedUploads(
  ctx: JobContext,
  opts: {
    prefixes?: string[];
    pageSize?: number;
    maxPages?: number;
    listObjects?: typeof listStorageObjects;
  } = {},
): Promise<{ deleted: number }> {
  const prefixes = opts.prefixes ?? [...SWEEP_PREFIXES];
  const pageSize = opts.pageSize ?? SWEEP_PAGE_SIZE;
  const maxPages = opts.maxPages ?? SWEEP_MAX_PAGES;
  const list = opts.listObjects ?? listStorageObjects;
  const remove = ctx.removeObjects ?? removeStorageObjects;
  if (prefixes.some((p) => !SWEEP_PREFIXES.some((root) => p.startsWith(root)))) {
    throw new Error('掃除できない prefix です');
  }
  if (prefixes.length === 0) return { deleted: 0 };

  const now = ctx.now.getTime();
  const client = getStorageClient(ctx.env);
  const saved = new Map(
    (
      await ctx.env.DB.prepare(READ_CURSORS)
        .bind(JSON.stringify(prefixes.map((p) => CURSOR_NAME + p)))
        .all<{ name: string; last_key: string }>()
    ).results.map((r) => [r.name, r.last_key]),
  );

  let deleted = 0;
  const next: [string, string][] = [];
  for (const prefix of prefixes) {
    let last = saved.get(CURSOR_NAME + prefix) ?? '';
    for (let page = 0; page < maxPages; page += 1) {
      const { objects, isTruncated } = await list(client, {
        prefix,
        startAfter: last,
        maxKeys: pageSize,
      });
      const candidates = objects.flatMap((o) => {
        const base = baseKeyOf(o.key);
        return base !== null && isPastGrace(o.lastModified, now) ? [{ key: o.key, base }] : [];
      });
      if (candidates.length > 0) {
        const bases = [...new Set(candidates.map((c) => c.base))];
        const referenced = new Set(
          (
            await ctx.env.DB.prepare(REFERENCED).bind(JSON.stringify(bases)).all<{ base: string }>()
          ).results.map((r) => r.base),
        );
        const keys = candidates.filter((c) => !referenced.has(c.base)).map((c) => c.key);
        if (keys.length > 0) {
          const failed = await remove(client, keys);
          deleted += keys.length - failed.length;
        }
      }
      if (!isTruncated || objects.length === 0) {
        last = '';
        break;
      }
      last = objects[objects.length - 1]!.key;
    }
    next.push([CURSOR_NAME + prefix, last]);
  }
  await ctx.env.DB.prepare(WRITE_CURSORS).bind(JSON.stringify(next), now).run();
  return { deleted };
}
sweepUnreferencedUploads satisfies Job;
