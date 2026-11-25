import { beforeAll, describe, expect, it } from 'vitest';
import { newId } from '../../src/shared/db/id';
import type { StorageEnv } from '../../src/shared/storage/client';
import { headObject, loadStorageEnv, putObjects } from './storage';

let env: StorageEnv;
beforeAll(async () => {
  env = await loadStorageEnv();
});

describe('putObjects', () => {
  it('putObjects は 20 個を全て置き、失敗した key を名前つきで返す', async () => {
    const prefix = `media/helper-test-${newId()}`;
    const keys = Array.from({ length: 20 }, (_, i) => `${prefix}/${i}`);
    await putObjects(env, keys);
    const heads = await Promise.all(keys.map((key) => headObject(env, key)));
    for (const head of heads) expect(head).toMatchObject({ size: 5 });

    // A refused PUT (a bucket that does not exist) rejects with the key's own name.
    const refused = { ...env, S3_BUCKET: `insta-missing-${newId().toLowerCase()}` };
    const key = `${prefix}/refused`;
    await expect(putObjects(refused, [key])).rejects.toThrow(
      new RegExp(`^PUT ${key}: [45]\\d\\d$`),
    );
  });

  it('putObjects は 8 本ずつ並べて置く', async () => {
    const prefix = `media/helper-test-${newId()}`;
    const keys = Array.from({ length: 24 }, (_, i) => `${prefix}/${i}`);
    let inFlight = 0;
    let peak = 0;
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (...args: Parameters<typeof fetch>) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      try {
        return await realFetch(...args);
      } finally {
        inFlight -= 1;
      }
    }) as typeof fetch;
    try {
      await putObjects(env, keys);
    } finally {
      globalThis.fetch = realFetch;
    }
    expect(peak).toBe(8);
  });
});
