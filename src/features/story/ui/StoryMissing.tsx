'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trapTab } from '../../../shared/ui/focus-trap';

/**
 * What the modal shows for a person with no story left to see: the error's message and "閉じる".
 * Closing is one step back, like the viewer; the focus stays inside until then.
 */
export function StoryMissing({ message }: { message: string }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus({ preventScroll: true });
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        router.back();
      } else if (root.current) {
        trapTab(e, root.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previous;
      const tray = document.querySelector('[data-testid="story-tray"]');
      const active = document.activeElement;
      if (!active || active === document.body) {
        tray?.querySelector<HTMLElement>('a')?.focus({ preventScroll: true });
      }
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black">
      <div
        ref={root}
        role="dialog"
        aria-modal="true"
        aria-label="ストーリー"
        className="flex w-[min(92vw,400px)] flex-col items-center gap-3 rounded-xl bg-bg p-6 text-text"
      >
        <p className="text-[length:var(--font-size-md)] font-bold">{message}</p>
        <button
          ref={closeButton}
          type="button"
          onClick={() => router.back()}
          className="min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 font-bold hover:bg-surface"
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
