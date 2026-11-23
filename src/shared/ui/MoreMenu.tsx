'use client';

import { MORE_LINKS } from './nav-items';

export const MORE_MENU_ID = 'more-menu';

/**
 * The 「その他」 menu. A native popover (`popover="auto"`) opened by the buttons whose
 * `popovertarget` is its id: it opens without JavaScript, Esc and a press outside close it, and
 * the browser returns the focus to the button. The toggle handler only mirrors the open state into the
 * buttons' `aria-expanded`.
 */
export function MoreMenu() {
  return (
    <div
      id={MORE_MENU_ID}
      popover="auto"
      role="group"
      aria-label="その他"
      onToggle={(event) => {
        const open = (event as unknown as { newState: string }).newState === 'open';
        for (const button of document.querySelectorAll(`[popovertarget="${MORE_MENU_ID}"]`))
          button.setAttribute('aria-expanded', String(open));
      }}
      className="fixed inset-auto top-[calc(var(--mobile-top-bar-height)+4px)] right-2 m-0 w-[266px] rounded-[20px] border-0 bg-bg p-2 text-text shadow-panel nav:top-auto nav:right-auto nav:bottom-[76px] nav:left-3"
    >
      {MORE_LINKS.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className="flex min-h-11 items-center rounded-lg px-3 text-base transition-colors duration-[var(--motion-fast)] hover:bg-surface"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
