import { describe, expect, it } from 'vitest';
import { normalizeQuery } from './normalize-query';

describe('normalizeQuery', () => {
  it('大文字と全角と前後の空白を正規化する', () => {
    expect(normalizeQuery('HA')).toBe('ha');
    expect(normalizeQuery('ｈａ')).toBe('ha');
    expect(normalizeQuery('  ha　')).toBe('ha');
  });
});
