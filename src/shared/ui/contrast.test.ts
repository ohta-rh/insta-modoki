import { describe, expect, it } from 'vitest';
import { BODY_PAIRS, contrastRatio, meetsAA } from './contrast';
import { TOKENS } from './tokens';

describe('contrastRatio', () => {
  it('黒と白は 21、同じ色は 1', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('前景と背景の順序に依らない', () => {
    expect(contrastRatio('#111827', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#111827'),
      10,
    );
  });

  it('3 桁の短い表記も読める', () => {
    expect(contrastRatio('#fff', '#000')).toBeCloseTo(21, 5);
  });

  it('コーラルとティールは白の上で 3:1 に届かない（色の使い方の決まりの根拠）', () => {
    expect(contrastRatio(TOKENS['--color-coral'], TOKENS['--color-bg'])).toBeLessThan(3);
    expect(contrastRatio(TOKENS['--color-teal'], TOKENS['--color-bg'])).toBeLessThan(3);
  });

  it('フォーカスの輪郭のインディゴは白の上で 3:1 以上', () => {
    expect(contrastRatio(TOKENS['--color-indigo'], TOKENS['--color-bg'])).toBeGreaterThanOrEqual(3);
  });
});

describe('本文の組', () => {
  it('本文の組が全て 4.5:1 以上', () => {
    for (const [fg, bg] of BODY_PAIRS) {
      const ratio = contrastRatio(TOKENS[fg], TOKENS[bg]);
      expect(ratio, `${fg} / ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('決まった 5 組だけが一覧にある', () => {
    expect(BODY_PAIRS).toEqual([
      ['--color-text', '--color-bg'],
      ['--color-text-secondary', '--color-bg'],
      ['--color-text-secondary', '--color-surface'],
      ['--color-text-muted', '--color-bg'],
      ['--color-link', '--color-bg'],
    ]);
  });

  it('4.5 ちょうどは通り 4.49 は落ちる', () => {
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(4.49)).toBe(false);
  });

  it('text-muted と surface の組は一覧に無い', () => {
    const has = BODY_PAIRS.some(
      ([fg, bg]) => fg === '--color-text-muted' && bg === '--color-surface',
    );
    expect(has).toBe(false);
    const linkOnSurface = BODY_PAIRS.some(
      ([fg, bg]) => fg === '--color-link' && bg === '--color-surface',
    );
    expect(linkOnSurface).toBe(false);
  });
});
