import { beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../tests/helpers/db';
import { headObject, loadStorageEnv, putObject, putPhoto } from '../../tests/helpers/storage';
import { createUser } from '../../tests/helpers/users';
import type { StorageEnv } from '../shared/storage/client';
import { removeObjects } from '../shared/storage/remove';
import { cleanupExpiredStories } from './story-cleanup';
import type { JobD1, JobEnv } from './types';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});

const NOW = new Date('2026-11-22T00:00:00.000Z');
const DAY = 86_400_000;

/** The slot's storage with a D1 binding that records every statement it prepares. */
const counted = (): { env: JobEnv; sql: string[] } => {
  const sql: string[] = [];
  const DB: JobD1 = {
    prepare: (s) => {
      sql.push(s);
      return t.d1.prepare(s) as never;
    },
    batch: (s) => t.d1.batch(s as never[]),
  };
  return { env: { ...storage, DB }, sql };
};
const plainEnv = (): JobEnv => ({ ...storage, DB: t.d1 as never });

async function addStory(
  authorId: string,
  options: { type?: 'image' | 'video'; expiresAt: number; files?: boolean },
) {
  const type = options.type ?? 'image';
  const storageKey = `stories/${authorId}/${crypto.randomUUID()}`;
  const id = crypto.randomUUID();
  await t.d1
    .prepare(
      `INSERT INTO stories (id, author_id, type, storage_key, width, height, duration_ms, alt_text, created_at, expires_at) VALUES ('${id}', '${authorId}', '${type}', '${storageKey}', 100, 100, ${type === 'video' ? 5000 : 'NULL'}, '', ${options.expiresAt - DAY}, ${options.expiresAt})`,
    )
    .run();
  const keys =
    type === 'video'
      ? [`${storageKey}/video.mp4`]
      : ['orig', 'w320', 'w640', 'w1080'].map((f) => `${storageKey}/${f}.webp`);
  if (options.files !== false) {
    if (type === 'video') await putObject(storage, keys[0]!, new Uint8Array(5), 'video/mp4');
    else await putPhoto(storage, storageKey);
  }
  return { id, storageKey, keys };
}

const storyIds = async () =>
  (await t.d1.prepare('SELECT id FROM stories ORDER BY id').all<{ id: string }>()).results.map(
    (r) => r.id,
  );
const count = async (table: string) =>
  (await t.d1.prepare(`SELECT COUNT(*) AS c FROM ${table}`).all<{ c: number }>()).results[0]!.c;
const orphanRows = async () =>
  (
    await t.d1
      .prepare('SELECT storage_key, attempts FROM storage_orphans ORDER BY storage_key')
      .all<{ storage_key: string; attempts: number }>()
  ).results;

/** Inserts `total` expired stories in bulk (no files) and returns nothing; keys are `stories/bulk/<i>`. */
async function addBulk(authorId: string, total: number) {
  for (let i = 0; i < total; i += 50) {
    const rows = [];
    for (let j = i; j < Math.min(total, i + 50); j++) {
      const exp = NOW.getTime() - 1000 - j;
      rows.push(
        `('b${j}', '${authorId}', 'image', 'stories/bulk/${j}', 10, 10, NULL, '', ${exp - DAY}, ${exp})`,
      );
    }
    await t.d1
      .prepare(
        `INSERT INTO stories (id, author_id, type, storage_key, width, height, duration_ms, alt_text, created_at, expires_at) VALUES ${rows.join(',')}`,
      )
      .run();
  }
}

describe('cleanupExpiredStories', () => {
  it('期限切れの行とファイルを消し、期限内のものを残す', async () => {
    const author = await createUser(t.db);
    const expired = [
      await addStory(author.id, { expiresAt: NOW.getTime() - 1 }),
      await addStory(author.id, { expiresAt: NOW.getTime() - 1000 }),
      await addStory(author.id, { type: 'video', expiresAt: NOW.getTime() - 2000 }),
    ];
    const live = await addStory(author.id, { expiresAt: NOW.getTime() + DAY });

    const result = await cleanupExpiredStories({ env: plainEnv(), now: NOW });

    expect(result).toEqual({ deleted: 3 });
    expect(await storyIds()).toEqual([live.id]);
    for (const s of expired) {
      for (const k of s.keys) expect(await headObject(storage, k), k).toBeNull();
    }
    for (const k of live.keys) expect(await headObject(storage, k), k).not.toBeNull();
  });

  it('expires_at ちょうどは消し、1 ms 後は残す', async () => {
    const author = await createUser(t.db);
    const exact = await addStory(author.id, { expiresAt: NOW.getTime(), files: false });
    const later = await addStory(author.id, { expiresAt: NOW.getTime() + 1, files: false });

    expect(await cleanupExpiredStories({ env: plainEnv(), now: NOW })).toEqual({ deleted: 1 });
    expect(await storyIds()).toEqual([later.id]);
    expect(await storyIds()).not.toContain(exact.id);
  });

  it('閲覧の記録も連鎖して消える', async () => {
    const author = await createUser(t.db);
    const viewer = await createUser(t.db);
    const expired = await addStory(author.id, { expiresAt: NOW.getTime() - 1, files: false });
    const live = await addStory(author.id, { expiresAt: NOW.getTime() + DAY, files: false });
    for (const s of [expired, live]) {
      await t.d1
        .prepare(
          `INSERT INTO story_views (story_id, viewer_id, created_at) VALUES ('${s.id}', '${viewer.id}', 1)`,
        )
        .run();
    }

    await cleanupExpiredStories({ env: plainEnv(), now: NOW });

    const views = (
      await t.d1.prepare('SELECT story_id FROM story_views').all<{ story_id: string }>()
    ).results;
    expect(views).toEqual([{ story_id: live.id }]);
  });

  it('250 件を 100 件ずつ消し、1 回の実行は 1,000 件までにする', async () => {
    const author = await createUser(t.db);
    await addBulk(author.id, 250);
    const calls: number[] = [];
    const spy = vi.fn(async (client: Parameters<typeof removeObjects>[0], keys: string[]) => {
      calls.push(keys.length);
      return removeObjects(client, keys);
    });
    const c = counted();

    expect(await cleanupExpiredStories({ env: c.env, now: NOW, removeObjects: spy })).toEqual({
      deleted: 250,
    });
    expect(c.sql.filter((s) => s.startsWith('DELETE FROM stories'))).toHaveLength(3);
    expect(spy).toHaveBeenCalledTimes(3);
    expect(calls).toEqual([400, 400, 200]);
    expect(await count('stories')).toBe(0);

    await addBulk(author.id, 1001);
    const second = counted();
    expect(await cleanupExpiredStories({ env: second.env, now: NOW, removeObjects: spy })).toEqual({
      deleted: 1000,
    });
    expect(await cleanupExpiredStories({ env: plainEnv(), now: NOW, removeObjects: spy })).toEqual({
      deleted: 1,
    });
  });

  it('ファイルの削除に失敗しても行は戻さず storage_orphans に残す', async () => {
    const author = await createUser(t.db);
    const a = await addStory(author.id, { expiresAt: NOW.getTime() - 1 });
    const failing = `${a.storageKey}/w640.webp`;
    // The key is already in storage_orphans: the insert must not fail on it.
    await t.d1
      .prepare(
        `INSERT INTO storage_orphans (storage_key, created_at, attempts) VALUES ('${failing}', 1, 3)`,
      )
      .run();
    const fake = vi.fn(async (client: Parameters<typeof removeObjects>[0], keys: string[]) => {
      await removeObjects(
        client,
        keys.filter((k) => k !== failing),
      );
      return [failing];
    });

    const result = await cleanupExpiredStories({ env: plainEnv(), now: NOW, removeObjects: fake });

    expect(result).toEqual({ deleted: 1 });
    expect(await count('stories')).toBe(0);
    expect(await orphanRows()).toEqual([{ storage_key: failing, attempts: 3 }]);
    for (const k of a.keys.filter((k) => k !== failing)) {
      expect(await headObject(storage, k), k).toBeNull();
    }

    // A fresh failing key is recorded with attempts 0.
    const b = await addStory(author.id, { expiresAt: NOW.getTime() - 1 });
    const failingB = `${b.storageKey}/orig.webp`;
    const fakeB = vi.fn(async () => [failingB]);
    await cleanupExpiredStories({ env: plainEnv(), now: NOW, removeObjects: fakeB });
    expect(await orphanRows()).toContainEqual({ storage_key: failingB, attempts: 0 });
  });

  it('対象が無いときと 2 回目は何も消さない', async () => {
    const author = await createUser(t.db);
    const viewer = await createUser(t.db);
    const live = await addStory(author.id, { expiresAt: NOW.getTime() + DAY, files: false });
    await t.d1
      .prepare(
        `INSERT INTO story_views (story_id, viewer_id, created_at) VALUES ('${live.id}', '${viewer.id}', 1)`,
      )
      .run();
    await t.d1
      .prepare(`INSERT INTO storage_orphans (storage_key, created_at, attempts) VALUES ('k', 1, 0)`)
      .run();

    for (let i = 0; i < 2; i++) {
      expect(await cleanupExpiredStories({ env: plainEnv(), now: NOW })).toEqual({ deleted: 0 });
      expect(await count('stories')).toBe(1);
      expect(await count('story_views')).toBe(1);
      expect(await count('storage_orphans')).toBe(1);
    }
  });
});
