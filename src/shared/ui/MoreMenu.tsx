'use client';

import { useEffect, useRef } from 'react';
import { MORE_LINKS } from './nav-items';

export const MORE_MENU_ID = 'more-menu';

/**
 * The 「その他」 menu. A native popover (`popover="auto"`) opened by the buttons whose
 * `popovertarget` is its id: it opens without JavaScript, Esc and a press outside close it, and
 * the browser returns the focus to the button. The effect only mirrors the open state into the
 * buttons' `aria-expanded`.
 */
export function MoreMenu() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const buttons = () => [
      ...document.querySelectorAll<HTMLElement>(`[popovertarget="${MORE_MENU_ID}"]`),
    ];
    const onToggle = (event: Event) => {
      const next = (event as Event & { newState?: string }).newState;
      const open = next === 'open';
      for (const button of buttons()) button.setAttribute('aria-expanded', String(open));
    };
    menu.addEventListener('toggle', onToggle);
    return () => menu.removeEventListener('toggle', onToggle);
  }, []);

  return (
    <div
      ref={ref}
      id={MORE_MENU_ID}
      popover="auto"
      role="group"
      aria-label="その他"
      className="fixed inset-auto top-[calc(var(--mobile-top-bar-height)+4px)] right-2 m-0 w-[266px] rounded-[20px] border-0 bg-bg p-2 text-text shadow-[var(--shadow-panel)] nav:top-auto nav:right-auto nav:bottom-[76px] nav:left-3"
    >
      {MORE_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="flex min-h-[var(--tap-min)] items-center rounded-lg px-3 text-[length:var(--font-size-md)] text-text transition-colors duration-[var(--motion-fast)] hover:bg-surface"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
