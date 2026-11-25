import sharp from 'sharp';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { generateImage } from './images';

const widthOf = async (bytes: Uint8Array) => {
  const m = await sharp(bytes).metadata();
  return { format: m.format, width: m.width, height: m.height };
};

describe('generateImage', { timeout: 60_000 }, () => {
  afterEach(() => vi.restoreAllMocks());

  it('4 つの WebP の幅が 1080 以上・320・640・1080 になる', async () => {
    const img = await generateImage(7);
    const [orig, w320, w640, w1080] = await Promise.all([
      widthOf(img.orig),
      widthOf(img.w320),
      widthOf(img.w640),
      widthOf(img.w1080),
    ]);
    for (const f of [orig, w320, w640, w1080]) expect(f.format).toBe('webp');
    expect(orig.width).toBeGreaterThanOrEqual(1080);
    expect([w320.width, w640.width, w1080.width]).toEqual([320, 640, 1080]);
    expect([1080, 1350]).toContain(orig.height);
    expect(img.width).toBe(orig.width);
    expect(img.height).toBe(orig.height);
    expect(w320.height).toBe(Math.round((320 * img.height) / img.width));
  });

  it('同じ seed なら同じバイト列で seed が違えば違う', async () => {
    const a = await generateImage(11);
    const b = await generateImage(11);
    const c = await generateImage(12);
    for (const k of ['orig', 'w320', 'w640', 'w1080'] as const) {
      expect(Buffer.from(a[k]).equals(Buffer.from(b[k]))).toBe(true);
    }
    expect(a.altText).toBe(b.altText);
    expect(a.thumbhash).toBe(b.thumbhash);
    expect(Buffer.from(a.orig).equals(Buffer.from(c.orig))).toBe(false);
  });

  it('代替テキストと thumbhash が空でない', async () => {
    const img = await generateImage(3);
    expect(img.altText.length).toBeGreaterThan(0);
    expect(img.altText.length).toBeLessThanOrEqual(500);
    expect(img.thumbhash).toMatch(/^[A-Za-z0-9+/]+=*$/);
  });

  it('fetch を呼ばない', async () => {
    const spy = vi.spyOn(globalThis, 'fetch');
    await generateImage(5);
    expect(spy).not.toHaveBeenCalled();
  });
});
