import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from './store';

const env = {
  S3_ENDPOINT: ['http:', '', 'storage.test'].join('/'),
  S3_REGION: 'garage',
  S3_ACCESS_KEY: 'access-key-value',
  S3_SECRET_KEY: 'secret-key-value',
  S3_BUCKET: 'insta-s3',
};

describe('createStore().copy', () => {
  afterEach(() => vi.restoreAllMocks());

  it('200 で <Error> の本文が返ったとき、Code と Message を含めて失敗する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<Error><Code>InternalError</Code><Message>try again</Message></Error>', {
        status: 200,
      }),
    );
    const failure = createStore(env).copy([['media/a/1/orig.webp', 'media/b/2/orig.webp']]);
    await expect(failure).rejects.toThrow(/InternalError.*try again/);
    await expect(failure).rejects.not.toThrow(/secret-key-value|access-key-value/);
  });

  it('複製に成功した応答では失敗しない', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<CopyObjectResult><ETag>"x"</ETag></CopyObjectResult>', { status: 200 }),
    );
    await expect(
      createStore(env).copy([['media/a/1/orig.webp', 'media/b/2/orig.webp']]),
    ).resolves.toBeUndefined();
  });
});
