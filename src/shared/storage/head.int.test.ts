import { beforeAll, describe, expect, it } from 'vitest';
import { loadStorageEnv, putObject } from '../../../tests/helpers/storage';
import { getStorageClient, type StorageEnv } from './client';
import { headObject } from './head';

let env: StorageEnv;
beforeAll(async () => {
  env = await loadStorageEnv();
});

describe('headObject', () => {
  it('在るオブジェクトの大きさと種類を返し 無いものには null を返す', async () => {
    const key = `media/head-test/${crypto.randomUUID()}/orig.webp`;
    await putObject(env, key, new Uint8Array(7), 'image/webp');
    const client = getStorageClient(env);
    expect(await headObject(client, key)).toEqual({ size: 7, contentType: 'image/webp' });
    expect(await headObject(client, `${key}.missing`)).toBeNull();
  });

  it('404 以外の失敗は投げる', async () => {
    const client = getStorageClient({ ...env, S3_SECRET_KEY: 'wrong-secret' });
    await expect(headObject(client, 'media/head-test/x/orig.webp')).rejects.toThrow(
      'オブジェクトを確認できませんでした',
    );
  });
});
