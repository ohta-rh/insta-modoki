import { beforeAll, describe, expect, it } from 'vitest';
import { loadStorageEnv, putObject } from '../../../tests/helpers/storage';
import { getStorageClient, type StorageEnv } from './client';
import { getRange } from './get-range';

let env: StorageEnv;
beforeAll(async () => {
  env = await loadStorageEnv();
});

describe('getRange', () => {
  it('指定した範囲のバイトを返し 終わりを越える分は返さない', async () => {
    const key = `stories/range-test/${crypto.randomUUID()}/video.mp4`;
    await putObject(env, key, Uint8Array.from({ length: 100 }, (_, i) => i), 'video/mp4');
    const client = getStorageClient(env);
    expect([...(await getRange(client, key, 10, 4))]).toEqual([10, 11, 12, 13]);
    expect([...(await getRange(client, key, 0, 1))]).toEqual([0]);
    expect((await getRange(client, key, 90, 50)).length).toBe(10);
  });

  it('無いオブジェクトと 範囲の外と 認証の失敗は投げる', async () => {
    const client = getStorageClient(env);
    await expect(getRange(client, 'stories/range-test/none/video.mp4', 0, 16)).rejects.toThrow(
      'オブジェクトを読めませんでした',
    );
    const key = `stories/range-test/${crypto.randomUUID()}/video.mp4`;
    await putObject(env, key, new Uint8Array(5), 'video/mp4');
    await expect(getRange(client, key, 100, 16)).rejects.toThrow('オブジェクトを読めませんでした');
    const bad = getStorageClient({ ...env, S3_SECRET_KEY: 'wrong-secret' });
    await expect(getRange(bad, key, 0, 1)).rejects.toThrow('オブジェクトを読めませんでした');
  });
});
