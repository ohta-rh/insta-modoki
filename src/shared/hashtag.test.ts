import { describe, expect, it } from 'vitest';
import {
  HASHTAG_COUNT_MESSAGE,
  HASHTAG_LENGTH_MESSAGE,
  MAX_HASHTAGS,
  MAX_HASHTAG_LENGTH,
  extractHashtags,
  isTagName,
  normalizeTag,
  parseCaption,
} from './hashtag';

describe('extractHashtags', () => {
  it('大文字小文字と全角半角の違うタグを同じタグにまとめる', () => {
    const result = extractHashtags('朝の散歩 #Tokyo #ＴＯＫＹＯ と #cafe_time #東京');
    expect(result).toEqual(['tokyo', 'cafe_time', '東京']);
  });

  it('語の途中と URL の # と空の # をタグにしない', () => {
    expect(extractHashtags('a#b')).toEqual([]);
    expect(extractHashtags('https://x.test/#top')).toEqual([]);
    expect(extractHashtags('#')).toEqual([]);
    expect(extractHashtags('# space')).toEqual([]);
    expect(extractHashtags('##x')).toEqual(['x']);
    expect(extractHashtags('#tag!')).toEqual(['tag']);
    expect(extractHashtags('_#x')).toEqual([]);
  });
});

describe('parseCaption', () => {
  it('タグを書かれたままの文字で分け、正規化した名前を持たせる', () => {
    expect(parseCaption('#Tokyo の朝')).toEqual([
      { type: 'tag', text: '#Tokyo', name: 'tokyo' },
      { type: 'text', text: ' の朝' },
    ]);
  });

  it('101 字のタグはタグにしない', () => {
    const long = 'a'.repeat(101);
    const parts = parseCaption(`x #${long} #ok`);
    expect(parts.filter((p) => p.type === 'tag').map((p) => p.text)).toEqual(['#ok']);
    expect(parts.map((p) => p.text).join('')).toBe(`x #${long} #ok`);
  });

  it('タグの無いキャプションは 1 つの文字にする。空は空', () => {
    expect(parseCaption('ただの文')).toEqual([{ type: 'text', text: 'ただの文' }]);
    expect(parseCaption('')).toEqual([]);
  });
});

describe('isTagName と定数', () => {
  it('名前にできるのは 1〜100 字の文字・数字・結合文字・_ だけ', () => {
    expect(isTagName('tokyo')).toBe(true);
    expect(isTagName('東京_1')).toBe(true);
    expect(isTagName('')).toBe(false);
    expect(isTagName('a b')).toBe(false);
    expect(isTagName('a#b')).toBe(false);
    expect(isTagName('a'.repeat(100))).toBe(true);
    expect(isTagName('a'.repeat(101))).toBe(false);
  });

  it('normalizeTag は NFKC にして小文字にする', () => {
    expect(normalizeTag('ＴＯＫＹＯ')).toBe('tokyo');
    expect(MAX_HASHTAGS).toBe(30);
    expect(MAX_HASHTAG_LENGTH).toBe(100);
    expect(HASHTAG_COUNT_MESSAGE).toBe('ハッシュタグは 30 個までです');
    expect(HASHTAG_LENGTH_MESSAGE).toBe('ハッシュタグは 100 字までです');
  });
});
