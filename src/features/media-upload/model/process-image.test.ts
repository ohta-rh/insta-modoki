import { describe, expect, it } from 'vitest';
import { processImage, type ImageDeps } from './process-image';

type Draw = { sx: number; sy: number; sw: number; sh: number; dw: number; dh: number };

/** A fake bitmap and canvas: records every draw and encodes to a blob of the requested type. */
function fakeDeps(
  source: { width: number; height: number },
  opts: { blobType?: string; readFails?: boolean } = {},
) {
  const canvases: { width: number; height: number; draws: Draw[]; quality?: number }[] = [];
  const deps: ImageDeps = {
    async createBitmap() {
      if (opts.readFails) throw new Error('decode');
      return { ...source, close() {} };
    },
    createCanvas(width, height) {
      const rec: (typeof canvases)[number] = { width, height, draws: [] };
      canvases.push(rec);
      return {
        width,
        height,
        getContext: () => ({
          imageSmoothingQuality: 'low',
          drawImage(
            _b: unknown,
            sx: number,
            sy: number,
            sw: number,
            sh: number,
            _dx: number,
            _dy: number,
            dw: number,
            dh: number,
          ) {
            rec.draws.push({ sx, sy, sw, sh, dw, dh });
          },
          getImageData: (_x: number, _y: number, w: number, h: number) => ({
            width: w,
            height: h,
            data: new Uint8ClampedArray(w * h * 4).fill(128),
          }),
        }),
        async convertToBlob(o: { type: string; quality: number }) {
          rec.quality = o.quality;
          return new Blob([new Uint8Array(width + height)], {
            type: opts.blobType ?? 'image/webp',
          });
        },
      };
    },
  };
  return { deps, canvases };
}
const file = new File([new Uint8Array(10)], 'p.jpg', { type: 'image/jpeg' });

describe('processImage', () => {
  it('4000x3000 の写真を 原本 2048x1536 と 1080 640 320 幅の WebP にする', async () => {
    const { deps, canvases } = fakeDeps({ width: 4000, height: 3000 });
    const r = await processImage(file, {}, deps);
    expect([r.width, r.height]).toEqual([2048, 1536]);
    const sizes = canvases.slice(0, 4).map((c) => [c.width, c.height]);
    expect(sizes).toEqual([
      [2048, 1536],
      [1080, 810],
      [640, 480],
      [320, 240],
    ]);
    expect(canvases.slice(0, 4).every((c) => c.quality === 0.82)).toBe(true);
    for (const name of ['orig', 'w320', 'w640', 'w1080'] as const) {
      expect(r.blobs[name].type).toBe('image/webp');
    }
    expect(r.blobs.w320.size).toBe(320 + 240);
  });

  it('800x600 の写真は拡大しない', async () => {
    const { deps, canvases } = fakeDeps({ width: 800, height: 600 });
    const r = await processImage(file, {}, deps);
    expect([r.width, r.height]).toEqual([800, 600]);
    expect(canvases.slice(0, 4).map((c) => [c.width, c.height])).toEqual([
      [800, 600],
      [800, 600],
      [640, 480],
      [320, 240],
    ]);
  });

  it('ThumbHash は base64 で 25 バイト以下になり 100px 以下の絵から作る', async () => {
    const { deps, canvases } = fakeDeps({ width: 4000, height: 3000 });
    const r = await processImage(file, {}, deps);
    expect(atob(r.thumbhash).length).toBeLessThanOrEqual(25);
    expect(atob(r.thumbhash).length).toBeGreaterThan(0);
    const small = canvases[4]!;
    expect(Math.max(small.width, small.height)).toBeLessThanOrEqual(100);
  });

  it('切り抜きの矩形を元の画素で描く', async () => {
    const { deps, canvases } = fakeDeps({ width: 4000, height: 3000 });
    const r = await processImage(
      file,
      { crop: { x: 100, y: 200, width: 2000, height: 1000 } },
      deps,
    );
    expect([r.width, r.height]).toEqual([2000, 1000]);
    expect(canvases[0]!.draws[0]).toMatchObject({
      sx: 100,
      sy: 200,
      sw: 2000,
      sh: 1000,
      dw: 2000,
      dh: 1000,
    });
  });

  it('WebP を作れないブラウザでは 理由つきで失敗する', async () => {
    const { deps } = fakeDeps({ width: 100, height: 100 }, { blobType: 'image/png' });
    await expect(processImage(file, {}, deps)).rejects.toThrow(
      'このブラウザでは写真を変換できません',
    );
  });

  it('読み込めない形式のとき 理由つきで失敗する', async () => {
    const { deps } = fakeDeps({ width: 100, height: 100 }, { readFails: true });
    await expect(processImage(file, {}, deps)).rejects.toThrow(
      'この形式の写真は、このブラウザでは読み込めません',
    );
  });
});
