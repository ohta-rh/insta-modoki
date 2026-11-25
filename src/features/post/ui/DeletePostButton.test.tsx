import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The component is called as a plain function: hooks are replaced by fixed stand-ins.
const dialogEl = { open: false, showModal: vi.fn() };
vi.mock('react', async (orig) => ({
  ...(await orig<typeof import('react')>()),
  useRef: (initial: unknown) => ({ current: initial === null ? dialogEl : initial }),
  useState: (initial: unknown) => [initial, vi.fn()],
  useId: () => 'id',
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('../api/actions', () => ({ deletePostAction: vi.fn() }));
vi.mock('./PostDeletedContext', () => ({ usePostDeletedHandler: () => undefined }));

import { DeletePostButton } from './DeletePostButton';

/** The "削除" trigger's onClick, found in the element tree the component returns. */
function trigger(variant?: 'button' | 'menu-item') {
  const root = DeletePostButton({
    postId: 'p1',
    username: 'haru',
    ...(variant ? { variant } : {}),
  }) as ReactElement<{
    children: ReactElement<{ onClick?: () => void; type?: string; className?: string }>[];
  }>;
  return root.props.children[0]!;
}
const triggerOnClick = (): (() => void) => trigger().props.onClick!;

describe('DeletePostButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    dialogEl.showModal.mockClear();
  });

  it('command に対応するブラウザでは onClick から開かず 対応しないブラウザでは開く', () => {
    vi.stubGlobal('HTMLButtonElement', { prototype: { command: '' } });
    triggerOnClick()();
    expect(dialogEl.showModal).not.toHaveBeenCalled();

    vi.stubGlobal('HTMLButtonElement', { prototype: {} });
    triggerOnClick()();
    expect(dialogEl.showModal).toHaveBeenCalledTimes(1);
  });

  it('menu-item はメニューの行の形（幅いっぱい・危険色・600）で出る', () => {
    const row = trigger('menu-item').props.className ?? '';
    for (const part of ['w-full', 'text-danger', 'font-semibold']) expect(row).toContain(part);
    expect(trigger().props.className ?? '').not.toContain('w-full');
  });
});
