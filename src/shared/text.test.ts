import { describe, expect, it } from 'vitest';
import { charLength, hasControlChars } from './text';

describe('charLength', () => {
  it('ASCII の文字列のとき 文字数を返す', () => {
    expect(charLength('abc')).toBe(3);
  });

  it('サロゲートペアの絵文字のとき 1 字と数える', () => {
    expect(charLength('😀')).toBe(1);
    expect(charLength('a😀b')).toBe(3);
  });

  it('日本語と結合文字のとき コードポイントで数える', () => {
    expect(charLength('あいう')).toBe(3);
    expect(charLength('é')).toBe(2);
  });

  it('空文字のとき 0', () => {
    expect(charLength('')).toBe(0);
  });
});

describe('hasControlChars', () => {
  it('NUL と制御文字を含むとき true', () => {
    expect(hasControlChars('a\u0000b')).toBe(true);
    expect(hasControlChars('a\nb')).toBe(true);
    expect(hasControlChars('a\u007fb')).toBe(true);
    expect(hasControlChars('a\u0085b')).toBe(true);
  });

  it('通常の文字のとき false', () => {
    expect(hasControlChars('haru_01 あ😀')).toBe(false);
  });
});
