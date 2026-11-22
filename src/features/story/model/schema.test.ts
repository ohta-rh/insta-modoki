import { describe, expect, it } from 'vitest';
import { parseCreateStory, parseStoryUploadRequest } from './schema';

const photo = (over: Record<string, unknown> = {}) => ({
  contentType: 'image/jpeg',
  size: 1000,
  width: 800,
  height: 600,
  variantSizes: { orig: 40, w320: 10, w640: 20, w1080: 30 },
  ...over,
});
const video = (over: Record<string, unknown> = {}) => ({
  kind: 'video',
  contentType: 'video/mp4',
  size: 1000,
  durationMs: 5000,
  ...over,
});

describe('parseStoryUploadRequest', () => {
  it('動画の長さが 15,001 ms のとき検証に失敗する', () => {
    const result = parseStoryUploadRequest(video({ durationMs: 15_001 }));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('VALIDATION');
      expect(result.fieldErrors?.media).toEqual(['動画は 15 秒までです']);
    }
    expect(parseStoryUploadRequest(video({ durationMs: 15_000 })).ok).toBe(true);
  });

  it('動画の大きさの境界は PAYLOAD_TOO_LARGE で 形式の誤りは VALIDATION', () => {
    expect(parseStoryUploadRequest(video({ size: 31_457_280 })).ok).toBe(true);
    const big = parseStoryUploadRequest(video({ size: 31_457_281 }));
    expect(big).toMatchObject({
      ok: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'ファイルが大きすぎます（動画は 30MB まで）',
    });
    for (const contentType of ['video/quicktime', 'image/gif']) {
      expect(parseStoryUploadRequest(video({ contentType }))).toMatchObject({
        ok: false,
        code: 'VALIDATION',
      });
    }
    expect(parseStoryUploadRequest(video({ durationMs: 0 })).ok).toBe(false);
    expect(parseStoryUploadRequest(video({ size: 1.5 })).ok).toBe(false);
  });

  it('写真は 1 件だけで 大きさの境界は PAYLOAD_TOO_LARGE', () => {
    const run = (file: unknown, n = 1) =>
      parseStoryUploadRequest({ kind: 'image', files: Array.from({ length: n }, () => file) });
    expect(run(photo({ size: 10_485_760 })).ok).toBe(true);
    expect(run(photo({ size: 10_485_761 }))).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(
      run(photo({ variantSizes: { orig: 10_485_761, w320: 1, w640: 1, w1080: 1 } })),
    ).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
    expect(run(photo(), 2)).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(run(photo(), 0)).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(run(photo({ contentType: 'image/gif' }))).toMatchObject({ code: 'VALIDATION' });
    expect(run(photo({ width: 2049 }))).toMatchObject({ code: 'VALIDATION' });
    expect(parseStoryUploadRequest(null)).toMatchObject({ ok: false, code: 'VALIDATION' });
    expect(parseStoryUploadRequest({ kind: 'audio' })).toMatchObject({ code: 'VALIDATION' });
  });
});

describe('parseCreateStory', () => {
  it('写真は大きさが必須で 代替テキストは前後の空白を除いて 500 字まで', () => {
    const base = { key: 'stories/u/k', type: 'image', width: 10, height: 10, altText: ' hi ' };
    expect(parseCreateStory(base)).toEqual({ ok: true, data: { ...base, altText: 'hi' } });
    expect(parseCreateStory({ ...base, width: undefined }).ok).toBe(false);
    expect(parseCreateStory({ ...base, width: 2049 }).ok).toBe(false);
    expect(parseCreateStory({ ...base, altText: 'a'.repeat(501) }).ok).toBe(false);
    expect(parseCreateStory({ ...base, altText: 'a'.repeat(500) }).ok).toBe(true);
    expect(parseCreateStory({ key: 'k', type: 'video', altText: '' }).ok).toBe(true);
    expect(parseCreateStory({ key: 'k', type: 'gif', altText: '' }).ok).toBe(false);
    expect(parseCreateStory(null).ok).toBe(false);
  });
});
