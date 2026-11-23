import { describe, expect, it } from 'vitest';
import { BODY_PAIRS, NON_TEXT_PAIRS, contrastRatio, meetsAA, meetsNonText } from './contrast';
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
  it('本文の組は全て 4.5:1 以上で、補助の文字を面の上の組に入れない', () => {
    expect(BODY_PAIRS).toEqual([
      ['--color-text', '--color-bg'],
      ['--color-text', '--color-surface'],
      ['--color-text', '--color-highlight'],
      ['--color-text-secondary', '--color-bg'],
      ['--color-text-secondary', '--color-wash'],
      ['--color-link', '--color-bg'],
      ['--color-danger', '--color-bg'],
      ['--color-bg', '--color-indigo'],
    ]);
    for (const [fg, bg] of BODY_PAIRS) {
      const ratio = contrastRatio(TOKENS[fg], TOKENS[bg]);
      expect(ratio, `${fg} / ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
    const onSurface = BODY_PAIRS.filter(
      ([fg, bg]) =>
        fg === '--color-text-secondary' && (bg === '--color-surface' || bg === '--color-highlight'),
    );
    expect(onSurface).toEqual([]);
  });

  it('4.5 ちょうどは通り 4.49 は落ちる', () => {
    expect(meetsAA(4.5)).toBe(true);
    expect(meetsAA(4.49)).toBe(false);
  });
});

describe('図形の組', () => {
  it('図形の組（いいねの赤・補助のアイコン・入力の枠）は 3:1 以上', () => {
    expect(NON_TEXT_PAIRS).toEqual([
      ['--color-like', '--color-bg'],
      ['--color-icon-secondary', '--color-bg'],
      ['--color-input-border', '--color-bg'],
    ]);
    for (const [fg, bg] of NON_TEXT_PAIRS) {
      const ratio = contrastRatio(TOKENS[fg], TOKENS[bg]);
      expect(ratio, `${fg} / ${bg} = ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('3 ちょうどは通り 2.99 は落ちる', () => {
    expect(meetsNonText(3)).toBe(true);
    expect(meetsNonText(2.99)).toBe(false);
  });
});
