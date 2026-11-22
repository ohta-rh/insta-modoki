import { beforeAll, describe, expect, it } from 'vitest';
import { loadStorageEnv, putObjects } from '../../../tests/helpers/storage';
import { getStorageClient, type StorageClient, type StorageEnv } from './client';
import { listObjects } from './list';

let env: StorageEnv;
let client: StorageClient;
beforeAll(async () => {
  env = await loadStorageEnv();
  client = getStorageClient(env);
});

describe('listObjects (Garage)', () => {
  it('prefix と start-after と max-keys で一覧し LastModified をミリ秒で返す', async () => {
    const dir = `media/list-test/${crypto.randomUUID()}`;
    const keys = ['a.webp', 'b & c.webp', 'd.webp'].map((f) => `${dir}/${f}`);
    await putObjects(env, [...keys, `other-${dir}/x.webp`]);

    const before = Date.now();
    const first = await listObjects(client, { prefix: `${dir}/`, maxKeys: 2 });
    expect(first.objects.map((o) => o.key)).toEqual(keys.slice(0, 2));
    expect(first.isTruncated).toBe(true);
    for (const o of first.objects) {
      expect(Number.isInteger(o.lastModified)).toBe(true);
      expect(Math.abs(before - o.lastModified)).toBeLessThan(5 * 60_000);
    }

    const second = await listObjects(client, {
      prefix: `${dir}/`,
      startAfter: first.objects[1]!.key,
      maxKeys: 2,
    });
    expect(second.objects.map((o) => o.key)).toEqual([keys[2]]);
    expect(second.isTruncated).toBe(false);
  });
});
