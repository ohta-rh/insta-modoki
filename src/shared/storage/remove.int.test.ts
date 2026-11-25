import { beforeAll, describe, expect, it } from 'vitest';
import { headObject, loadStorageEnv } from '../../../tests/helpers/storage';
import { getStorageClient, objectUrl, type StorageClient, type StorageEnv } from './client';
import { removeObjects } from './remove';

let env: StorageEnv;
let client: StorageClient;
beforeAll(async () => {
  env = await loadStorageEnv();
  client = getStorageClient(env);
});

const putObject = async (key: string) => {
  const res = await client.aws.fetch(objectUrl(client, key), {
    method: 'PUT',
    body: new Uint8Array(5),
    headers: { 'content-type': 'image/webp' },
  });
  expect(res.status).toBe(200);
};

describe('removeObjects', () => {
  it('指定したオブジェクトだけを消し 無いキーや空の指定でも失敗しない', async () => {
    const dir = `media/remove-test/${crypto.randomUUID()}`;
    const [a, b, keep] = [`${dir}/a.webp`, `${dir}/b.webp`, `${dir}/keep.webp`];
    await Promise.all([putObject(a), putObject(b), putObject(keep)]);

    expect(await removeObjects(client, [a, b, `${dir}/missing.webp`])).toEqual([]);
    expect(await headObject(env, a)).toBeNull();
    expect(await headObject(env, b)).toBeNull();
    expect(await headObject(env, keep)).not.toBeNull();

    expect(await removeObjects(client, [])).toEqual([]);
    expect(await removeObjects(client, [keep])).toEqual([]);
  });

  it('12 個のキーを 1 回の要求で消す', async () => {
    const dir = `media/remove-test/${crypto.randomUUID()}`;
    const keys = Array.from({ length: 12 }, (_, i) => `${dir}/k${i} 日本.webp`);
    for (const key of keys) await putObject(key);
    const seen: string[] = [];
    const counting: StorageClient = {
      ...client,
      aws: {
        fetch: (url: string, init?: RequestInit) => {
          seen.push(`${init?.method} ${url}`);
          return client.aws.fetch(url, init);
        },
      } as StorageClient['aws'],
    };

    expect(await removeObjects(counting, keys)).toEqual([]);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toMatch(/^POST .*\?delete$/);
    for (const key of keys) expect(await headObject(env, key), key).toBeNull();
  });
});
