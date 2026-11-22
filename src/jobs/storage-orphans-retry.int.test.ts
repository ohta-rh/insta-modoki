import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { useTestDb } from '../../tests/helpers/db';
import { headObject, loadStorageEnv, putObjects } from '../../tests/helpers/storage';
import type { StorageEnv } from '../shared/storage/client';
import { removeObjects } from '../shared/storage/remove';
import { retryStorageOrphans } from './storage-orphans-retry';

const t = useTestDb();

let storage: StorageEnv;
beforeAll(async () => {
  storage = await loadStorageEnv();
});
afterEach(() => vi.restoreAllMocks());

const NOW = new Date('2026-11-22T00:00:00.000Z');

describe('retryStorageOrphans', () => {
  it('消せたキーの行を消し、失敗したキーの attempts を増やし、上限の行は対象にしない', async () => {
    const prefix = `orphans/${crypto.randomUUID()}`;
    const [a, b, c, d] = ['a', 'b', 'c', 'd'].map((n) => `${prefix}/${n}`) as [
      string,
      string,
      string,
      string,
    ];
    await putObjects(storage, [a, b, c, d]);
    const rows: [string, number, number][] = [
      [a, 1, 0],
      [b, 2, 2],
      [c, 3, 9],
      [d, 4, 10],
    ];
    for (const [key, createdAt, attempts] of rows) {
      await t.d1
        .prepare(
          `INSERT INTO storage_orphans (storage_key, created_at, attempts) VALUES ('${key}', ${createdAt}, ${attempts})`,
        )
        .run();
    }
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    // `c` fails again; the others are removed for real.
    const fake = vi.fn(async (client: Parameters<typeof removeObjects>[0], keys: string[]) => {
      await removeObjects(
        client,
        keys.filter((k) => k !== c),
      );
      return keys.includes(c) ? [c] : [];
    });

    const result = await retryStorageOrphans({
      env: { ...storage, DB: t.d1 as never },
      now: NOW,
      removeObjects: fake,
    });

    expect(result).toEqual({ deleted: 2 });
    expect(fake.mock.calls[0]![1]).toEqual([a, b, c]);
    const left = (
      await t.d1
        .prepare('SELECT storage_key, attempts FROM storage_orphans ORDER BY storage_key')
        .all<{ storage_key: string; attempts: number }>()
    ).results;
    expect(left).toEqual([
      { storage_key: c, attempts: 10 },
      { storage_key: d, attempts: 10 },
    ]);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith('storage_orphans: 再試行の上限に達しました: 1 件');
    expect(await headObject(storage, a)).toBeNull();
    expect(await headObject(storage, b)).toBeNull();
    expect(await headObject(storage, d)).not.toBeNull();
  });
});
