import { describe, expect, it } from 'vitest';
import { ALPHABET, CODE_LENGTH, CODE_PATTERN, generateCode, normalizeCode } from './code';

/** A random source that hands out the given bytes in order, as getRandomValues would. */
function source(bytes: number[]) {
  let i = 0;
  return (buf: Uint8Array) => {
    for (let k = 0; k < buf.length; k++) buf[k] = bytes[i++ % bytes.length]!;
    return buf;
  };
}

describe('generateCode', () => {
  it('36 文字から偏りなく 10 字を選ぶ（受理・棄却の境界の 252 以上を捨てる）', () => {
    // 252, 253, 254, 255 are rejected (256 is not a multiple of 36: they would favour A-D);
    // 251 is the last accepted value (251 % 36 = 35 -> '9'); 0 -> 'A'.
    const code = generateCode(source([255, 252, 254, 253, 251, 0, 36, 71, 72, 35, 1, 2, 3, 4, 5]));
    // accepted in order: 251 -> 9, 0 -> A, 36 -> A, 71 -> 9, 72 -> A, 35 -> 9, 1 -> B, 2 -> C, 3 -> D, 4 -> E
    expect(code).toBe('9AA9A9BCDE');
  });

  it('作った 10 字は英大文字と数字だけで、毎回違う', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      expect(CODE_PATTERN.test(code)).toBe(true);
      seen.add(code);
    }
    expect(seen.size).toBe(50);
    expect(ALPHABET).toHaveLength(36);
  });
});

describe('normalizeCode', () => {
  it('前後の空白を除いて大文字にする', () => {
    expect(normalizeCode('  abcde12345 \n')).toBe('ABCDE12345');
  });
});
