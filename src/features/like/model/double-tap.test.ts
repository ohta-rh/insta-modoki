import { describe, expect, it } from 'vitest';
import { DOUBLE_TAP_MS, isDoubleTap } from './double-tap';

describe('isDoubleTap', () => {
  it('前のタップが無いとき false', () => {
    expect(isDoubleTap(null, 1000)).toBe(false);
  });

  it('300ms 以内の 2 回目のとき true', () => {
    expect(isDoubleTap(1000, 1000 + DOUBLE_TAP_MS)).toBe(true);
    expect(isDoubleTap(1000, 1001)).toBe(true);
  });

  it('300ms を超えたとき false', () => {
    expect(isDoubleTap(1000, 1000 + DOUBLE_TAP_MS + 1)).toBe(false);
  });

  it('時計が戻ったとき false', () => {
    expect(isDoubleTap(1000, 900)).toBe(false);
  });
});
