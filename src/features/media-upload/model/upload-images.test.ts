import { describe, expect, it } from 'vitest';
import type { ProcessedImage } from './process-image';
import { uploadImages, UPLOAD_FAILED_MESSAGE, type UploadDeps } from './upload-images';

const processed = (n: number): ProcessedImage => ({
  width: 800 + n,
  height: 600,
  thumbhash: `hash${n}`,
  blobs: {
    orig: new Blob([new Uint8Array(40)], { type: 'image/webp' }),
    w320: new Blob([new Uint8Array(10)], { type: 'image/webp' }),
    w640: new Blob([new Uint8Array(20)], { type: 'image/webp' }),
    w1080: new Blob([new Uint8Array(30)], { type: 'image/webp' }),
  },
});
const jpeg = (name = 'a.jpg') => new File([new Uint8Array(100)], name, { type: 'image/jpeg' });

function setup(over: Partial<UploadDeps> = {}) {
  const calls = { requests: [] as unknown[], puts: [] as { url: string; type: string }[] };
  let active = 0;
  let maxActive = 0;
  let n = 0;
  const deps: UploadDeps = {
    process: async () => processed(n++),
    requestUrls: async (input) => {
      calls.requests.push(input);
      const files = (input as { files: unknown[] }).files;
      return {
        ok: true,
        uploads: files.map((_, i) => ({
          key: `media/u/k${i}`,
          putUrls: {
            orig: `https://s/k${i}/orig`,
            w320: `https://s/k${i}/w320`,
            w640: `https://s/k${i}/w640`,
            w1080: `https://s/k${i}/w1080`,
          },
        })),
      };
    },
    fetch: async (url, init) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((r) => setTimeout(r, 1));
      active -= 1;
      calls.puts.push({
        url: String(url),
        type: new Headers(init?.headers).get('content-type') ?? '',
      });
      return new Response(null, { status: 200 });
    },
    ...over,
  };
  return { deps, calls, maxActive: () => maxActive };
}

describe('uploadImages', () => {
  it('変換して URL を求め 4 つのファイルを PUT し key と幅高さと ThumbHash を返す', async () => {
    const { deps, calls, maxActive } = setup();
    const result = await uploadImages([jpeg('a.jpg'), jpeg('b.jpg')], {}, deps);
    expect(result).toEqual([
      { key: 'media/u/k0', width: 800, height: 600, thumbhash: 'hash0' },
      { key: 'media/u/k1', width: 801, height: 600, thumbhash: 'hash1' },
    ]);
    expect(calls.requests).toEqual([
      {
        files: [
          {
            contentType: 'image/jpeg',
            size: 100,
            width: 800,
            height: 600,
            variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
          },
          {
            contentType: 'image/jpeg',
            size: 100,
            width: 801,
            height: 600,
            variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
          },
        ],
      },
    ]);
    expect(calls.puts).toHaveLength(8);
    expect(calls.puts.every((p) => p.type === 'image/webp')).toBe(true);
    expect(maxActive()).toBeLessThanOrEqual(4);
  });

  it('検証で拒む写真があるとき 通信を 1 件もしない', async () => {
    let processed = 0;
    const { deps, calls } = setup({
      process: async () => {
        processed += 1;
        return {} as never;
      },
    });
    const gif = new File([new Uint8Array(5)], 'a.gif', { type: 'image/gif' });
    await expect(uploadImages([jpeg(), gif], {}, deps)).rejects.toThrow(
      'この形式は使えません（JPEG・PNG・WebP・HEIC）',
    );
    expect(processed).toBe(0);
    expect(calls.requests).toHaveLength(0);
    expect(calls.puts).toHaveLength(0);
  });

  it('PUT が 1 つでも失敗したら 全体を失敗にする', async () => {
    let count = 0;
    const { deps } = setup({
      fetch: async () => {
        count += 1;
        return new Response(null, { status: count === 3 ? 403 : 200 });
      },
    });
    await expect(uploadImages([jpeg()], {}, deps)).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });

  it('ネットワークが失敗したとき 同じ理由で失敗する', async () => {
    const { deps } = setup({
      fetch: async () => {
        throw new TypeError('network');
      },
    });
    await expect(uploadImages([jpeg()], {}, deps)).rejects.toThrow(UPLOAD_FAILED_MESSAGE);
  });

  it('サーバーが断ったとき その理由をそのまま伝える', async () => {
    const { deps } = setup({
      requestUrls: async () => ({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: '操作が多すぎます。しばらくしてからもう一度お試しください',
        },
      }),
    });
    await expect(uploadImages([jpeg()], {}, deps)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      message: '操作が多すぎます。しばらくしてからもう一度お試しください',
    });
  });

  it('切り抜きの矩形を写真ごとに渡す', async () => {
    const seen: unknown[] = [];
    const { deps } = setup({
      process: async (_f, o) => {
        seen.push(o);
        return processed(0);
      },
    });
    const crop = { x: 1, y: 2, width: 3, height: 4 };
    await uploadImages([jpeg(), jpeg()], { crops: [crop, undefined] }, deps);
    expect(seen).toEqual([{ crop }, { crop: undefined }]);
  });
});
