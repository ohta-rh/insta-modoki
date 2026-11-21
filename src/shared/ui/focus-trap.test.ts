import { describe, expect, it } from 'vitest';
import { trapTab, wrapFocus } from './focus-trap';

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

type Fake = {
  name: string;
  shown: boolean;
  focused: boolean;
  focus(): void;
  getClientRects(): unknown[];
};
const fake = (name: string, shown = true): Fake => ({
  name,
  shown,
  focused: false,
  focus() {
    this.focused = true;
  },
  getClientRects() {
    return this.shown ? [{}] : [];
  },
});
const press = (shiftKey: boolean, key = 'Tab') => {
  let prevented = false;
  return {
    e: { key, shiftKey, preventDefault: () => (prevented = true) },
    prevented: () => prevented,
  };
};

describe('trapTab', () => {
  const a = fake('a');
  const hidden = fake('hidden', false);
  const b = fake('b');
  const container = {
    querySelectorAll: () => [a, hidden, b] as unknown as HTMLElement[],
    contains: (n: unknown) => n === a || n === b,
  };

  it('wraps forward from the last visible item to the first', () => {
    const k = press(false);
    expect(trapTab(k.e, container, b as unknown as HTMLElement)).toBe(true);
    expect(a.focused).toBe(true);
    expect(k.prevented()).toBe(true);
  });

  it('wraps backward from the first item to the last visible one', () => {
    b.focused = false;
    const k = press(true);
    expect(trapTab(k.e, container, a as unknown as HTMLElement)).toBe(true);
    expect(b.focused).toBe(true);
  });

  it('sends focus from outside the container to the first item', () => {
    a.focused = false;
    const k = press(false);
    expect(trapTab(k.e, container, hidden as unknown as HTMLElement)).toBe(true);
    expect(a.focused).toBe(true);
  });

  it('ignores other keys and leaves the middle to the browser', () => {
    const other = press(false, 'Enter');
    expect(trapTab(other.e, container, a as unknown as HTMLElement)).toBe(false);
    expect(other.prevented()).toBe(false);
    const c = fake('c');
    const three = {
      querySelectorAll: () => [a, c, b] as unknown as HTMLElement[],
      contains: () => true,
    };
    const k = press(false);
    expect(trapTab(k.e, three, c as unknown as HTMLElement)).toBe(false);
    expect(k.prevented()).toBe(false);
  });
});
