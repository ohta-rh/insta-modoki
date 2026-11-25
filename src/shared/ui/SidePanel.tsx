import { useEffect, useRef, useState, type ReactNode } from 'react';

export const SIDE_PANEL_ID = 'side-panel';

type Panels = Record<string, { title: string; content: ReactNode } | undefined>;

/**
 * The panel that slides out to the right of the collapsed side navigation (search, notifications).
 * It is a supplementary dialog over the page, not a modal: no `aria-modal`, no focus trap, and it
 * follows the navigation in the DOM so Tab runs through it before the page. Closed, it is inert
 * and its content is not rendered (a panel loads its data only when it is opened).
 */
export function SidePanel({ panels, open }: { panels: Panels; open: string | null }) {
  const current = open === null ? undefined : panels[open];
  // The title stays while the panel slides out, so the closing panel does not lose its name.
  const [shown, setShown] = useState(current);
  if (current && current !== shown) setShown(current);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open === null) return;
    const el = root.current;
    if (!el) return;
    const target =
      el.querySelector<HTMLElement>('input, textarea, select') ??
      el.querySelector<HTMLElement>('h2');
    target?.focus({ preventScroll: true });
  }, [open]);

  return (
    <div
      ref={root}
      id={SIDE_PANEL_ID}
      role="dialog"
      aria-labelledby="side-panel-title"
      inert={open === null}
      className={`shell-panel ${open === null ? 'shell-panel-closed' : ''}`}
    >
      <h2 id="side-panel-title" tabIndex={-1} className="shell-panel-title">
        {shown?.title}
      </h2>
      {current ? current.content : null}
    </div>
  );
}
