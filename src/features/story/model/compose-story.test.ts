import { describe, expect, it } from 'vitest';
import { box, buildMp4 } from '../../../../tests/helpers/mp4';
import { composeStory, inspectVideo, type ComposeDeps } from './compose-story';

const mp4 = (durationMs: number, name = 'clip.mp4') =>
  new File([buildMp4({ timescale: 1000, duration: durationMs, width: 320, height: 568 })], name, {
    type: 'video/mp4',
  });
const jpeg = (name = 'a.jpg') => new File([new Uint8Array(100)], name, { type: 'image/jpeg' });

function setup(over: Partial<ComposeDeps> = {}) {
  const calls = {
    uploads: [] as unknown[],
    creates: [] as unknown[],
    puts: [] as { url: string; type: string; size: number }[],
  };
  const deps: ComposeDeps = {
    process: async () => ({
      width: 800,
      height: 600,
      thumbhash: 'h',
      blobs: {
        orig: new Blob([new Uint8Array(40)]),
        w320: new Blob([new Uint8Array(10)]),
        w640: new Blob([new Uint8Array(20)]),
        w1080: new Blob([new Uint8Array(30)]),
      },
    }),
    requestStoryUpload: async (input) => {
      calls.uploads.push(input);
      const kind = (input as { kind: string }).kind;
      return kind === 'video'
        ? { ok: true as const, key: 'stories/u/k', putUrls: { video: 'https://s/k/video' } }
        : {
            ok: true as const,
            key: 'stories/u/k',
            putUrls: {
              orig: 'https://s/k/orig',
              w320: 'https://s/k/w320',
              w640: 'https://s/k/w640',
              w1080: 'https://s/k/w1080',
            },
          };
    },
    createStory: async (input) => {
      calls.creates.push(input);
      return { ok: true, storyId: 'story-1' };
    },
    fetch: async (url, init) => {
      calls.puts.push({
        url: String(url),
        type: new Headers(init?.headers).get('content-type') ?? '',
        size: (init?.body as Blob).size,
      });
      return new Response(null, { status: 200 });
    },
    ...over,
  };
  return { deps, calls };
}

describe('inspectVideo', () => {
  it('15,000 ms までの MP4 を通し 長さを返す', async () => {
    expect(await inspectVideo(mp4(15_000))).toEqual({ ok: true, durationMs: 15_000 });
    expect(await inspectVideo(mp4(5000))).toEqual({ ok: true, durationMs: 5000 });
  });

  it('長すぎる動画 形式の違い 大きすぎる 読めない動画を通信の前に拒む', async () => {
    expect(await inspectVideo(mp4(15_001))).toEqual({ ok: false, message: '動画は 15 秒までです' });
    const mov = new File([new Uint8Array(10)], 'a.mov', { type: 'video/quicktime' });
    expect(await inspectVideo(mov)).toEqual({
      ok: false,
      message: 'この形式は使えません（JPEG・PNG・WebP・HEIC・MP4）',
    });
    const big = { name: 'big.mp4', type: 'video/mp4', size: 31_457_281 } as File;
    expect(await inspectVideo(big)).toEqual({
      ok: false,
      message: 'ファイルが大きすぎます（動画は 30MB まで）',
    });
    const junk = new File([box('free', new Uint8Array(40))], 'junk.mp4', { type: 'video/mp4' });
    expect(await inspectVideo(junk)).toEqual({ ok: false, message: '動画を読み込めませんでした' });
    const empty = new File([], 'empty.mp4', { type: 'video/mp4' });
    expect(await inspectVideo(empty)).toMatchObject({ ok: false });
  });
});

describe('composeStory', () => {
  it('動画は 長さを調べ URL を求め video.mp4 を PUT し key で作る', async () => {
    const { deps, calls } = setup();
    const file = mp4(5000);
    const result = await composeStory({ file, altText: '海' }, deps);
    expect(result).toEqual({ ok: true, storyId: 'story-1' });
    expect(calls.uploads).toEqual([
      { kind: 'video', contentType: 'video/mp4', size: file.size, durationMs: 5000 },
    ]);
    expect(calls.puts).toEqual([{ url: 'https://s/k/video', type: 'video/mp4', size: file.size }]);
    expect(calls.creates).toEqual([{ key: 'stories/u/k', type: 'video', altText: '海' }]);
  });

  it('16 秒の動画は何も送らずに止まる', async () => {
    const { deps, calls } = setup();
    const result = await composeStory({ file: mp4(16_000), altText: '' }, deps);
    expect(result).toEqual({ ok: false, message: '動画は 15 秒までです' });
    expect([calls.uploads, calls.puts, calls.creates]).toEqual([[], [], []]);
  });

  it('写真は 変換し 4 つのファイルを PUT し 申告した大きさと key で作る', async () => {
    const { deps, calls } = setup();
    const result = await composeStory({ file: jpeg(), altText: '' }, deps);
    expect(result).toEqual({ ok: true, storyId: 'story-1' });
    expect(calls.uploads).toEqual([
      {
        kind: 'image',
        files: [
          {
            contentType: 'image/jpeg',
            size: 100,
            width: 800,
            height: 600,
            variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
          },
        ],
      },
    ]);
    expect(calls.puts.map((p) => p.url).sort()).toEqual([
      'https://s/k/orig',
      'https://s/k/w1080',
      'https://s/k/w320',
      'https://s/k/w640',
    ]);
    expect(calls.puts.every((p) => p.type === 'image/webp')).toBe(true);
    expect(calls.creates).toEqual([
      { key: 'stories/u/k', type: 'image', width: 800, height: 600, altText: '' },
    ]);
  });

  it('形式の違う写真は何も送らずに止まる', async () => {
    const { deps, calls } = setup();
    const gif = new File([new Uint8Array(3)], 'a.gif', { type: 'image/gif' });
    expect(await composeStory({ file: gif, altText: '' }, deps)).toEqual({
      ok: false,
      message: 'この形式は使えません（JPEG・PNG・WebP・HEIC・MP4）',
    });
    expect([calls.uploads, calls.puts, calls.creates]).toEqual([[], [], []]);
  });

  it('サーバーの拒否はその文言で返し PUT の失敗と通信の失敗は定型の文言で返す', async () => {
    const refuse = setup({
      requestStoryUpload: async () => ({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: '操作が多すぎます。しばらくしてからもう一度お試しください',
        },
      }),
    });
    for (const file of [mp4(1000), jpeg()]) {
      expect(await composeStory({ file, altText: '' }, refuse.deps)).toEqual({
        ok: false,
        message: '操作が多すぎます。しばらくしてからもう一度お試しください',
      });
    }
    const POST_FAILED = '投稿できませんでした。もう一度お試しください';
    const putFails = setup({ fetch: async () => new Response(null, { status: 403 }) });
    expect(await composeStory({ file: mp4(1000), altText: '' }, putFails.deps)).toEqual({
      ok: false,
      message: POST_FAILED,
    });
    const throws = setup({
      fetch: async () => {
        throw new TypeError('network');
      },
    });
    expect(await composeStory({ file: mp4(1000), altText: '' }, throws.deps)).toEqual({
      ok: false,
      message: POST_FAILED,
    });
    expect((await composeStory({ file: jpeg(), altText: '' }, throws.deps)).ok).toBe(false);
    const createFails = setup({
      createStory: async () => ({
        ok: false,
        error: { code: 'VALIDATION', message: 'アップロードが完了していません' },
      }),
    });
    expect(await composeStory({ file: mp4(1000), altText: '' }, createFails.deps)).toEqual({
      ok: false,
      message: 'アップロードが完了していません',
    });
  });
});
