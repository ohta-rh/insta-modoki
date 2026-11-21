import { beforeAll, describe, expect, it } from 'vitest';
import { headObject, loadStorageEnv } from '../../../tests/helpers/storage';
import { getStorageClient, type StorageEnv, type StorageClient } from './client';
import { presignPut } from './presign';

let env: StorageEnv;
let client: StorageClient;
beforeAll(async () => {
  env = await loadStorageEnv();
  client = getStorageClient(env);
});

const newKey = () => `media/presign-test/${crypto.randomUUID()}/orig.webp`;
const bytes = (n: number) => new Uint8Array(n).fill(7);

async function put(url: string, body: Uint8Array, contentType = 'image/webp') {
  return fetch(url, { method: 'PUT', body, headers: { 'Content-Type': contentType } });
}

describe('presignPut', () => {
  it('署名どおりの PUT を受け付ける', async () => {
    const key = newKey();
    const url = await presignPut(client, {
      key,
      contentType: 'image/webp',
      contentLength: 100,
      expiresInSec: 300,
    });
    expect((await put(url, bytes(100))).status).toBe(200);
    expect(await headObject(env, key)).toEqual({ size: 100, contentType: 'image/webp' });
  });

  it('有効期限の 5 分を過ぎた URL への PUT を拒む', async () => {
    // The signed time has second precision, so "300 s later" is tested 2 s inside / 2 s outside.
    const inside = newKey();
    const insideUrl = await presignPut(client, {
      key: inside,
      contentType: 'image/webp',
      contentLength: 10,
      expiresInSec: 300,
      now: Date.now() - 298_000,
    });
    expect((await put(insideUrl, bytes(10))).status).toBe(200);

    const outside = newKey();
    const outsideUrl = await presignPut(client, {
      key: outside,
      contentType: 'image/webp',
      contentLength: 10,
      expiresInSec: 300,
      now: Date.now() - 302_000,
    });
    // R2 answers 403 and Garage 400 for an expired URL (ADR-0021): any 4xx is a refusal.
    const res = await put(outsideUrl, bytes(10));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await headObject(env, outside)).toBeNull();
  });

  it('指定と違う形式の PUT を拒む', async () => {
    const key = newKey();
    const url = await presignPut(client, {
      key,
      contentType: 'image/webp',
      contentLength: 10,
      expiresInSec: 300,
    });
    expect((await put(url, bytes(10), 'image/png')).status).toBe(403);
    expect((await put(url, bytes(10), 'text/html')).status).toBe(403);
    expect(await headObject(env, key)).toBeNull();
  });

  it('指定と違うサイズの PUT を拒む', async () => {
    const key = newKey();
    const url = await presignPut(client, {
      key,
      contentType: 'image/webp',
      contentLength: 10,
      expiresInSec: 300,
    });
    expect((await put(url, bytes(11))).status).toBe(403);
    expect((await put(url, bytes(9))).status).toBe(403);
    expect(await headObject(env, key)).toBeNull();
  });
});
