'use client';

import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';

/**
 * The caption, cut at two lines. The server's markup always carries "続きを読む" as a link to the
 * post's own screen (it works before hydration); once mounted, the link is dropped when the text
 * fits, and pressing it opens the whole caption in place and moves the focus to it.
 */
export function CaptionClamp({ postId, children }: { postId: string; children: ReactNode }) {
  const paragraph = useRef<HTMLParagraphElement>(null);
  const [state, setState] = useState<'clamped' | 'fits' | 'open'>('clamped');
  const open = state === 'open';

  useLayoutEffect(() => {
    const el = paragraph.current;
    if (!el || open) return;
    const measure = () => setState(el.scrollHeight > el.clientHeight + 1 ? 'clamped' : 'fits');
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [open]);

  return (
    <>
      <p
        ref={paragraph}
        tabIndex={-1}
        className={`text-[length:var(--font-size-sm)] break-words whitespace-pre-wrap ${open ? '' : 'line-clamp-2'}`}
      >
        {children}
      </p>
      {state === 'clamped' && (
        <a
          href={`/p/${postId}`}
          onClick={(event) => {
            event.preventDefault();
            setState('open');
            paragraph.current?.focus();
          }}
          className="block text-[length:var(--font-size-sm)] text-text-secondary"
        >
          続きを読む
        </a>
      )}
    </>
  );
}
