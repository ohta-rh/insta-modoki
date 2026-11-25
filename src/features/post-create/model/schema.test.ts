import { describe, expect, it } from 'vitest';
import { parseCreatePost } from './schema';

const photo = (over: Record<string, unknown> = {}) => ({
  key: 'media/u/0192f3c0-0000-7000-8000-000000000001',
  width: 800,
  height: 600,
  altText: '',
  thumbhash: 'YJqGPQw7sFlslqhFafSE+Q6oJ1h2iHB2Rw==',
  ...over,
});
const input = (over: Record<string, unknown> = {}) => ({
  caption: '',
  media: [photo()],
  clientRequestId: '0192f3c0-0000-7000-8000-0000000000aa',
  ...over,
});
const photos = (n: number) =>
  Array.from({ length: n }, (_, i) => photo({ key: `media/u/0192f3c0-0000-7000-8000-${i}` }));

describe('parseCreatePost', () => {
  it('写真は 1 枚から 10 枚まで受け付け 0 枚と 11 枚を拒む', () => {
    for (const n of [1, 10]) {
      expect(parseCreatePost(input({ media: photos(n) })).ok, `${n} 枚`).toBe(true);
    }
    for (const n of [0, 11]) {
      const r = parseCreatePost(input({ media: photos(n) }));
      expect(r.ok, `${n} 枚`).toBe(false);
      if (!r.ok) expect(r.fieldErrors.media).toEqual(['写真は 1 枚から 10 枚までです']);
    }
  });

  it('キャプションの 2200 字を受け付け 2201 字を拒む', () => {
    expect(parseCreatePost(input({ caption: 'あ'.repeat(2200) })).ok).toBe(true);
    // An emoji is one code point: 2200 of them are accepted though they are 4400 UTF-16 units.
    expect(parseCreatePost(input({ caption: '😀'.repeat(2200) })).ok).toBe(true);
    for (const caption of ['あ'.repeat(2201), '😀'.repeat(2201)]) {
      const r = parseCreatePost(input({ caption }));
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.fieldErrors.caption).toEqual(['キャプションは 2,200 字までです']);
    }
  });

  it('キャプションの前後の空白を除かない', () => {
    const r = parseCreatePost(input({ caption: '  こんにちは\n' }));
    expect(r.ok && r.data.caption).toBe('  こんにちは\n');
  });

  it('代替テキストの 500 字を受け付け 501 字を拒む', () => {
    expect(parseCreatePost(input({ media: [photo({ altText: 'あ'.repeat(500) })] })).ok).toBe(true);
    const r = parseCreatePost(input({ media: [photo(), photo({ altText: 'あ'.repeat(501) })] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.fieldErrors['media.1.altText']).toEqual(['代替テキストは 500 字までです']);
  });

  it('画素数と ThumbHash と clientRequestId の形を確かめる', () => {
    expect(parseCreatePost(input({ media: [photo({ width: 2048, height: 2048 })] })).ok).toBe(true);
    for (const bad of [
      { width: 2049 },
      { height: 0 },
      { width: 1.5 },
      { thumbhash: 'x'.repeat(41) },
      { thumbhash: 'not base64!' },
      { key: '' },
    ]) {
      expect(parseCreatePost(input({ media: [photo(bad)] })).ok, JSON.stringify(bad)).toBe(false);
    }
    expect(parseCreatePost(input({ clientRequestId: 'abc' })).ok).toBe(false);
    expect(parseCreatePost(input({ caption: 'a\0b' })).ok).toBe(false);
    expect(parseCreatePost(null).ok).toBe(false);
  });
});
