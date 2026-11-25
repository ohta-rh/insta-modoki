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
      className="shell-more-menu"
    >
      {MORE_LINKS.map((link) => (
        <a key={link.href} href={link.href} className="shell-more-link">
          {link.label}
        </a>
      ))}
    </div>
  );
}
