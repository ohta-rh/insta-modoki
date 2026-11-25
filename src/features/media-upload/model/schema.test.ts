import { describe, expect, it } from 'vitest';
import { parseUploadRequest, type UploadFile } from './schema';

const file = (over: Partial<UploadFile> = {}): UploadFile => ({
  contentType: 'image/jpeg',
  size: 1000,
  width: 800,
  height: 600,
  variantSizes: { orig: 500, w320: 100, w640: 200, w1080: 300 },
  ...over,
});
const codeOf = (input: unknown) => {
  const r = parseUploadRequest(input);
  return r.ok ? 'OK' : r.code;
};

describe('parseUploadRequest', () => {
  it('枚数と大きさと画素数の境界を受け付け 1 つ外を拒む', () => {
    expect(codeOf({ files: [file()] })).toBe('OK');
    expect(codeOf({ files: Array.from({ length: 10 }, () => file()) })).toBe('OK');
    expect(codeOf({ files: [] })).toBe('VALIDATION');
    expect(codeOf({ files: Array.from({ length: 11 }, () => file()) })).toBe('VALIDATION');

    expect(codeOf({ files: [file({ size: 10_485_760 })] })).toBe('OK');
    expect(codeOf({ files: [file({ size: 10_485_761 })] })).toBe('PAYLOAD_TOO_LARGE');
    const big = { orig: 10_485_761, w320: 1, w640: 1, w1080: 1 };
    expect(codeOf({ files: [file({ variantSizes: big })] })).toBe('PAYLOAD_TOO_LARGE');
    expect(
      codeOf({ files: [file({ variantSizes: { orig: 10_485_760, w320: 1, w640: 1, w1080: 1 } })] }),
    ).toBe('OK');

    expect(codeOf({ files: [file({ width: 2048, height: 2048 })] })).toBe('OK');
    expect(codeOf({ files: [file({ width: 2049 })] })).toBe('VALIDATION');
    expect(codeOf({ files: [file({ height: 2049 })] })).toBe('VALIDATION');
    expect(codeOf({ files: [file({ width: 0 })] })).toBe('VALIDATION');
    expect(codeOf({ files: [file({ height: 0 })] })).toBe('VALIDATION');
  });

  it('形式が許可外 または項目が欠けているとき VALIDATION になる', () => {
    expect(codeOf({ files: [file({ contentType: 'image/gif' as never })] })).toBe('VALIDATION');
    expect(codeOf({ files: [file({ contentType: 'text/html' as never })] })).toBe('VALIDATION');
    expect(
      codeOf({ files: [file({ variantSizes: { orig: 1, w320: 1, w640: 1 } as never })] }),
    ).toBe('VALIDATION');
    expect(codeOf({ files: [file({ size: 1.5 })] })).toBe('VALIDATION');
    expect(codeOf({ files: [file({ size: 0 })] })).toBe('VALIDATION');
    expect(codeOf({})).toBe('VALIDATION');
    expect(codeOf(null)).toBe('VALIDATION');
  });

  it('key を呼び出し側から受け取らない（余分な項目は捨てる）', () => {
    const r = parseUploadRequest({ files: [{ ...file(), key: 'media/other/x' }] });
    expect(r.ok && Object.keys(r.data.files[0]!)).not.toContain('key');
  });
});
