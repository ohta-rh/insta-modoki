import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { newId } from '../shared/db/id';
import { useTestDb } from '../../tests/helpers/db';
import { countQueries } from '../../tests/helpers/count-queries';
import { createPost } from '../../tests/helpers/posts';
import { headObject, loadStorageEnv, putObjects } from '../../tests/helpers/storage';
import { createUser } from '../../tests/helpers/users';
import type { StorageEnv } from '../shared/storage/client';
import { listObjects } from '../shared/storage/list';
import { removeObjects } from '../shared/storage/remove';
import type { JobD1, JobEnv } from './types';
import { sweepUnreferencedUploads } from './upload-orphan-sweep';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});
beforeEach(async () => {
  await t.d1.prepare('DELETE FROM job_cursors').run();
});

const DAY = 86_400_000;
/** The slot's Garage stamps files with the real clock: 24 h 1 min later they are past the grace. */
const later = () => new Date(Date.now() + DAY + 60_000);
/** The same D1 as `t.d1`, typed with `bind` the way jobs use it. */
const d1 = (): JobD1 => t.d1 as unknown as JobD1;
const plainEnv = (): JobEnv => ({ ...storage, DB: t.d1 as never });

const PHOTO = ['orig', 'w320', 'w640', 'w1080'].map((f) => `${f}.webp`);
const photoKeys = (base: string) => PHOTO.map((f) => `${base}/${f}`);
const exists = async (key: string) => (await headObject(storage, key)) !== null;
const count = async (table: string) =>
  (await t.d1.prepare(`SELECT COUNT(*) AS c FROM ${table}`).all<{ c: number }>()).results[0]!.c;

/** The AC-1 world: 5 unreferenced files and 3 referenced sets, under a fresh user. */
async function world() {
  const user = await createUser(t.db);
  const mediaPrefix = `media/${user.id}/`;
  const storiesPrefix = `stories/${user.id}/`;
  const orphanPhoto = photoKeys(`${mediaPrefix}${newId()}`);
  const orphanVideo = `${storiesPrefix}${newId()}/video.mp4`;
  const post = await createPost(t.db, user.id);
  const mediaBase = post.media[0]!.storageKey;
  const avatarBase = `${mediaPrefix}${newId()}`;
  await d1()
    .prepare('UPDATE users SET avatar_key = ? WHERE id = ?')
    .bind(avatarBase, user.id)
    .run();
  const storyBase = `${storiesPrefix}${newId()}`;
  const created = Date.now();
  await d1()
    .prepare(
      `INSERT INTO stories (id, author_id, type, storage_key, width, height, duration_ms, alt_text, created_at, expires_at) VALUES (?, ?, 'image', ?, 10, 10, NULL, '', ?, ?)`,
    )
    .bind(newId(), user.id, storyBase, created, created + DAY)
    .run();
  const kept = [...photoKeys(mediaBase), ...photoKeys(avatarBase), ...photoKeys(storyBase)];
  await putObjects(storage, [...orphanPhoto, orphanVideo, ...kept]);
  return {
    user,
    prefixes: [mediaPrefix, storiesPrefix],
    orphans: [...orphanPhoto, orphanVideo],
    kept,
  };
}

describe('sweepUnreferencedUploads', () => {
  it('24 時間を過ぎて行から参照されないファイルだけを消す', async () => {
    const w = await world();

    const result = await sweepUnreferencedUploads(
      { env: plainEnv(), now: later() },
      { prefixes: w.prefixes },
    );

    expect(result).toEqual({ deleted: 5 });
    for (const k of w.orphans) expect(await exists(k), k).toBe(false);
    for (const k of w.kept) expect(await exists(k), k).toBe(true);
  });

  it('置いてから 24 時間以内のファイルは参照が無くても消さない', async () => {
    const w = await world();
    const within = new Date(Date.now() + 23 * 3_600_000);

    const result = await sweepUnreferencedUploads(
      { env: plainEnv(), now: within },
      { prefixes: w.prefixes },
    );

    expect(result).toEqual({ deleted: 0 });
    for (const k of [...w.orphans, ...w.kept]) expect(await exists(k), k).toBe(true);
  });

  it('形の違うキーと media/・stories/ の外は消さない', async () => {
    const user = await createUser(t.db);
    const prefix = `media/${user.id}/`;
    const unsafe = [
      `${prefix}loose.webp`,
      `${prefix}${newId()}/sub/x.webp`,
      `other/${user.id}/${newId()}/orig.webp`,
    ];
    const orphan = `${prefix}${newId()}/orig.webp`;
    await putObjects(storage, [...unsafe, orphan]);
    const removed: string[] = [];
    const spy = vi.fn(async (c: Parameters<typeof removeObjects>[0], keys: string[]) => {
      removed.push(...keys);
      return removeObjects(c, keys);
    });
    const list = vi.fn(listObjects);

    const result = await sweepUnreferencedUploads(
      { env: plainEnv(), now: later(), removeObjects: spy },
      { prefixes: [prefix], listObjects: list },
    );

    expect(result).toEqual({ deleted: 1 });
    expect(removed).toEqual([orphan]);
    for (const k of unsafe) expect(await exists(k), k).toBe(true);

    for (const bad of [['other/'], [prefix, 'other/x/'], ['media-x/'], ['']]) {
      list.mockClear();
      await expect(
        sweepUnreferencedUploads(
          { env: plainEnv(), now: later() },
          { prefixes: bad, listObjects: list },
        ),
      ).rejects.toThrow(new Error('掃除できない prefix です'));
      expect(list).not.toHaveBeenCalled();
    }
  });

  it('1 回の実行は prefix ごとに maxPages ページまでで 続きは次の実行が job_cursors から読む', async () => {
    const user = await createUser(t.db);
    const prefix = `media/${user.id}/`;
    const keys = Array.from({ length: 5 }, (_, i) => `${prefix}i${i}/orig.webp`);
    await putObjects(storage, keys);
    const list = vi.fn(listObjects);
    const opts = { prefixes: [prefix], pageSize: 2, maxPages: 2, listObjects: list };

    const first = await sweepUnreferencedUploads({ env: plainEnv(), now: later() }, opts);
    expect(first).toEqual({ deleted: 4 });
    expect(list).toHaveBeenCalledTimes(2);
    expect(
      (
        await t.d1
          .prepare('SELECT name, last_key FROM job_cursors')
          .all<{ name: string; last_key: string }>()
      ).results,
    ).toEqual([{ name: `upload-orphan-sweep:${prefix}`, last_key: keys[3] }]);
    expect(await exists(keys[4]!)).toBe(true);

    list.mockClear();
    const second = await sweepUnreferencedUploads({ env: plainEnv(), now: later() }, opts);
    expect(second).toEqual({ deleted: 1 });
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]![1]).toMatchObject({ prefix, startAfter: keys[3], maxKeys: 2 });
    expect(await exists(keys[4]!)).toBe(false);
    expect(
      (await t.d1.prepare('SELECT last_key FROM job_cursors').all<{ last_key: string }>()).results,
    ).toEqual([{ last_key: '' }]);
  });

  it('既定の上限では 1 回の実行のストレージへの要求は 16 以下 D1 の文は 10 以下', async () => {
    const user = await createUser(t.db);
    const prefixes = [`media/${user.id}/`, `stories/${user.id}/`];
    for (const p of prefixes) {
      await putObjects(
        storage,
        Array.from({ length: 6 }, (_, i) => `${p}i${i}/orig.webp`),
      );
    }
    let requests = 0;
    const list: typeof listObjects = (c, i) => {
      requests += 1;
      return listObjects(c, i);
    };
    const remove: typeof removeObjects = (c, k) => {
      requests += 1;
      return removeObjects(c, k);
    };
    const counted = countQueries(t.d1);

    const result = await sweepUnreferencedUploads(
      { env: { ...storage, DB: counted.d1 as never }, now: later(), removeObjects: remove },
      { prefixes, pageSize: 1, listObjects: list },
    );

    expect(result).toEqual({ deleted: 8 });
    expect(requests).toBeLessThanOrEqual(16);
    expect(counted.count()).toBeLessThanOrEqual(10);
  });

  it('ファイルの削除に失敗しても例外を出さず 次の周回で消す', async () => {
    const user = await createUser(t.db);
    const prefix = `media/${user.id}/`;
    const keys = [`${prefix}a/orig.webp`, `${prefix}b/orig.webp`];
    await putObjects(storage, keys);
    const failing = keys[1]!;
    const fake = vi.fn(async (c: Parameters<typeof removeObjects>[0], ks: string[]) => {
      await removeObjects(
        c,
        ks.filter((k) => k !== failing),
      );
      return [failing];
    });

    const result = await sweepUnreferencedUploads(
      { env: plainEnv(), now: later(), removeObjects: fake },
      { prefixes: [prefix] },
    );

    expect(result).toEqual({ deleted: 1 });
    expect(await count('storage_orphans')).toBe(0);
    expect(await exists(failing)).toBe(true);
    expect(await exists(keys[0]!)).toBe(false);

    expect(
      await sweepUnreferencedUploads({ env: plainEnv(), now: later() }, { prefixes: [prefix] }),
    ).toEqual({ deleted: 1 });
    expect(await exists(failing)).toBe(false);
  });

  it('一覧に失敗すると何も消さずに失敗を投げる', async () => {
    const user = await createUser(t.db);
    const prefix = `media/${user.id}/`;
    const key = `${prefix}a/orig.webp`;
    await putObjects(storage, [key]);
    const name = `upload-orphan-sweep:${prefix}`;
    await d1()
      .prepare("INSERT INTO job_cursors (name, last_key, updated_at) VALUES (?, 'x', 1)")
      .bind(name)
      .run();
    const failing: typeof listObjects = (c, i) =>
      listObjects(
        {
          ...c,
          aws: { fetch: async () => new Response('bucket secret', { status: 500 }) },
        } as never,
        i,
      );

    const error = await sweepUnreferencedUploads(
      { env: plainEnv(), now: later() },
      { prefixes: [prefix], listObjects: failing },
    ).then(
      () => null,
      (e: unknown) => e as Error,
    );

    expect(error!.message).toBe('オブジェクトを一覧できませんでした: 500');
    expect(error!.message).not.toContain(key);
    expect(await exists(key)).toBe(true);
    expect(
      (await t.d1.prepare('SELECT name, last_key, updated_at FROM job_cursors').all()).results,
    ).toEqual([{ name, last_key: 'x', updated_at: 1 }]);
  });

  it('2 回目の実行は何も消さない', async () => {
    const w = await world();
    const run = () =>
      sweepUnreferencedUploads({ env: plainEnv(), now: later() }, { prefixes: w.prefixes });
    expect(await run()).toEqual({ deleted: 5 });
    const tables = ['media', 'users', 'stories', 'storage_orphans'];
    const snapshot = async () =>
      Promise.all(
        tables.map(async (n) => (await t.d1.prepare(`SELECT * FROM ${n}`).all()).results),
      );
    const before = await snapshot();

    expect(await run()).toEqual({ deleted: 0 });

    expect(await snapshot()).toEqual(before);
    for (const k of w.kept) expect(await exists(k), k).toBe(true);
  });
});
