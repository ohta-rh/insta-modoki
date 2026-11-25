'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, type ReactNode } from 'react';
import { PostDeletedProvider } from '../../post';
import { trapTab } from '../../../shared/ui/focus-trap';
import { useDeletedPosts } from './ProfilePostsProvider';

/**
 * A post opened from the profile grid, over the grid (an intercepting route). Closing is one
 * history step back, so Esc, "閉じる" and the browser's back all do the same thing. While it is
 * open the page behind does not scroll, the focus stays inside, and closing returns the focus to
 * the grid item that opened it.
 */
export function PostModal({ postId, children }: { postId: string; children: ReactNode }) {
  const router = useRouter();
  const { markDeleted } = useDeletedPosts();
  const modal = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  const close = useCallback(() => router.back(), [router]);
  const onDeleted = useCallback(
    (deletedId: string) => {
      markDeleted(deletedId);
      router.back();
    },
    [markDeleted, router],
  );

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });

    const nestedOpen = () => modal.current?.querySelector('dialog[open]') != null;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || nestedOpen()) return; // a delete or likers dialog on top handles its own keys
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (modal.current) {
        trapTab(e, modal.current);
      }
    };
    const onFocusIn = (e: FocusEvent) => {
      if (modal.current && e.target instanceof Node && !modal.current.contains(e.target)) {
        closeButton.current?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('focusin', onFocusIn);
      document.body.style.overflow = previous;
      // Back to the grid item that opened it, unless the focus already went somewhere else.
      const active = document.activeElement;
      if (!active || active === document.body) {
        const opener = Array.from(
          document.querySelectorAll<HTMLElement>('[data-testid="post-grid"] a'),
        ).find((a) => a.getAttribute('href') === `/p/${postId}`);
        opener?.focus({ preventScroll: true });
      }
    };
  }, [close, postId]);

  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-bg md:items-center md:bg-black/60"
      onClick={(e) => e.target === e.currentTarget && close()}
    >
      <div
        ref={modal}
        role="dialog"
        aria-modal="true"
        aria-label="投稿"
        className="post-modal relative h-full w-full overflow-y-auto bg-bg md:h-auto md:max-h-[90vh] md:max-w-[900px] md:rounded-xl"
      >
        <div className="sticky top-0 z-10 flex justify-end bg-bg">
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] px-4 font-bold hover:bg-surface"
          >
            閉じる
          </button>
        </div>
        <PostDeletedProvider value={onDeleted}>{children}</PostDeletedProvider>
      </div>
    </div>
  );
}
