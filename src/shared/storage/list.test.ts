import { describe, expect, it } from 'vitest';
import type { StorageClient } from './client';
import { listObjects } from './list';

const clientWith = (respond: () => Response) => {
  const urls: string[] = [];
  const client = {
    bucketUrl: 'http://s3.test/bucket',
    aws: {
      fetch: async (url: string) => {
        urls.push(url);
        return respond();
      },
    },
  } as unknown as StorageClient;
  return { client, urls };
};

describe('listObjects', () => {
  it('キーの XML の実体参照を戻し IsTruncated を読む', async () => {
    const { client, urls } = clientWith(
      () =>
        new Response(
          '<ListBucketResult><IsTruncated>true</IsTruncated>' +
            '<Contents><Key>media/u/a &amp; b &lt;&gt; &quot;.webp</Key><LastModified>2026-11-22T00:00:00.123Z</LastModified></Contents>' +
            '<Contents><Key>media/u/c.webp</Key><LastModified>2026-11-22T00:00:01.000Z</LastModified></Contents>' +
            '</ListBucketResult>',
          { status: 200 },
        ),
    );
    const result = await listObjects(client, {
      prefix: 'media/u/',
      startAfter: 'media/u/a',
      maxKeys: 2,
    });
    expect(result).toEqual({
      objects: [
        { key: 'media/u/a & b <> ".webp', lastModified: Date.parse('2026-11-22T00:00:00.123Z') },
        { key: 'media/u/c.webp', lastModified: Date.parse('2026-11-22T00:00:01.000Z') },
      ],
      isTruncated: true,
    });
    expect(urls).toEqual([
      'http://s3.test/bucket?list-type=2&prefix=media%2Fu%2F&max-keys=2&start-after=media%2Fu%2Fa',
    ]);
  });

  it('startAfter が空なら start-after を付けず IsTruncated が false なら false', async () => {
    const { client, urls } = clientWith(
      () => new Response('<ListBucketResult><IsTruncated>false</IsTruncated></ListBucketResult>'),
    );
    expect(await listObjects(client, { prefix: 'p/', startAfter: '', maxKeys: 5 })).toEqual({
      objects: [],
      isTruncated: false,
    });
    expect(urls[0]).not.toContain('start-after');
  });

  it('2xx でない応答は例外にする', async () => {
    const { client } = clientWith(() => new Response('secret-bucket-detail', { status: 500 }));
    await expect(listObjects(client, { prefix: 'p/', maxKeys: 1 })).rejects.toThrow(
      new Error('オブジェクトを一覧できませんでした: 500'),
    );
  });

  it('maxKeys は 1〜1000 の整数', async () => {
    const { client, urls } = clientWith(() => new Response('<ListBucketResult/>'));
    for (const bad of [0, 1001, 1.5, Number.NaN]) {
      await expect(listObjects(client, { prefix: 'p/', maxKeys: bad })).rejects.toThrow(
        new RangeError('maxKeys は 1〜1000 です'),
      );
    }
    expect(urls).toHaveLength(0);
  });
});
