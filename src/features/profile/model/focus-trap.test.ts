import { describe, expect, it } from 'vitest';
import { wrapFocus } from './focus-trap';

const items = ['close', 'like', 'delete'];

describe('wrapFocus', () => {
  it('最後の要素で Tab を押すと 最初の要素へ戻す', () => {
    expect(wrapFocus(items, 'delete', false)).toBe('close');
  });

  it('最初の要素で Shift+Tab を押すと 最後の要素へ移す', () => {
    expect(wrapFocus(items, 'close', true)).toBe('delete');
  });

  it('途中の要素では ブラウザの動きに任せる', () => {
    expect(wrapFocus(items, 'like', false)).toBeNull();
    expect(wrapFocus(items, 'like', true)).toBeNull();
  });

  it('フォーカスが中に無いとき 向きに応じて端の要素へ移す', () => {
    expect(wrapFocus(items, null, false)).toBe('close');
    expect(wrapFocus(items, 'outside', true)).toBe('delete');
  });

  it('要素が無いとき 何もしない', () => {
    expect(wrapFocus([], null, false)).toBeNull();
  });
});
