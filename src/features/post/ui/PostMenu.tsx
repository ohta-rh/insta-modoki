'use client';

import { useRef, useState, type ReactNode, type SyntheticEvent } from 'react';
import { MoreIcon } from '../../../shared/ui/icons';
import { copyPostLink } from '../model/copy-link';

const row =
  'flex min-h-[var(--tap-min)] w-full items-center justify-center border-b border-border px-4 text-[length:var(--font-size-sm)] text-text hover:bg-wash';

/**
 * The "…" of a post's header and the sheet it opens: go to the post, copy its link, cancel. The
 * button opens the popover by itself (`popovertarget`), so it works before hydration; the copy
 * needs the script. A copied link is announced and closes the sheet; a refused one is told in
 * `role="alert"` and the sheet stays open. `ownerItems` is where the author's own rows go (#94).
 */
export function PostMenu({ postId, ownerItems }: { postId: string; ownerItems?: ReactNode }) {
  const trigger = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState('');
  const [failed, setFailed] = useState('');
  const sheetId = `post-menu-${postId}`;

  const copy = async () => {
    setCopied('');
    setFailed('');
    const result = await copyPostLink(postId, window.location.origin, navigator.clipboard);
    if (result.ok) {
      setCopied(result.message);
      sheet.current?.hidePopover();
    } else {
      setFailed(result.message);
    }
  };

  const onToggle = (event: SyntheticEvent<HTMLDivElement>) => {
    const newState = (event.nativeEvent as Event & { newState?: string }).newState;
    if (newState === 'open') {
      // The focus moves in, onto the first row (a popover does not do it by itself).
      sheet.current?.querySelector<HTMLElement>('a[href], button')?.focus();
      return;
    }
    if (newState !== 'closed') return;
    setFailed('');
    // Give the focus back to the button, unless the sheet was dismissed by moving to another control.
    const active = document.activeElement;
    if (active === document.body || (active && sheet.current?.contains(active))) {
      trigger.current?.focus();
    }
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        popoverTarget={sheetId}
        aria-label="その他の操作"
        className="flex h-[var(--tap-min)] w-[var(--tap-min)] items-center justify-center rounded-full hover:bg-surface"
      >
        <MoreIcon />
      </button>
      <div
        ref={sheet}
        id={sheetId}
        popover="auto"
        role="dialog"
        aria-label="その他の操作"
        onToggle={onToggle}
        // Tab out of the menu closes it (the focus does not stay behind in a menu that is left).
        onBlur={(event) => {
          const next = event.relatedTarget;
          if (next instanceof Node && !event.currentTarget.contains(next)) {
            event.currentTarget.hidePopover();
          }
        }}
        className="fixed inset-0 m-auto h-fit w-[min(400px,90vw)] overflow-hidden rounded-xl border-0 bg-bg p-0 text-text shadow-panel backdrop:bg-black/65"
      >
        {ownerItems}
        <a href={`/p/${postId}`} className={row}>
          投稿へ移動
        </a>
        <button type="button" onClick={() => void copy()} className={row}>
          リンクをコピー
        </button>
        {failed && (
          <p
            role="alert"
            className="border-b border-border px-4 py-2 text-center text-[length:var(--font-size-sm)] text-danger"
          >
            {failed}
          </p>
        )}
        <button
          type="button"
          popoverTarget={sheetId}
          popoverTargetAction="hide"
          className={`${row} border-b-0`}
        >
          キャンセル
        </button>
      </div>
      <div role="status" className="sr-only">
        {copied}
      </div>
    </>
  );
}
