import { describe, expect, it } from 'vitest';
import { msUntilFreshWindow } from './rate-window';

const WINDOW = 60;

describe('msUntilFreshWindow', () => {
  it('窓の残りが必要な秒数より多いとき 0 を返す', () => {
    expect(msUntilFreshWindow(0, WINDOW, 20)).toBe(0);
    expect(msUntilFreshWindow(30_000, WINDOW, 20)).toBe(0);
  });

  it('窓の残りが必要な秒数より少ないとき 次の窓までのミリ秒を返す', () => {
    expect(msUntilFreshWindow(57_000, WINDOW, 20)).toBe(3_000);
    expect(msUntilFreshWindow(59_999, WINDOW, 20)).toBe(1);
    expect(msUntilFreshWindow(120_000 + 45_000, WINDOW, 20)).toBe(15_000);
  });

  it('窓の残りがちょうど必要な秒数のときは待たない', () => {
    expect(msUntilFreshWindow(40_000, WINDOW, 20)).toBe(0);
    expect(msUntilFreshWindow(40_001, WINDOW, 20)).toBe(19_999);
  });
});
