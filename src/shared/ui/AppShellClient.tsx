'use client';

import { usePathname } from 'next/navigation';
import {
  useCallback,
  useEffect,
  useState,
  type ComponentProps,
  type ComponentType,
  type MouseEvent,
  type ReactNode,
} from 'react';
import { AppShell, type AppShellProps, type PanelKey } from './AppShell';
import { isAuthScreen, type NavItem, type Viewer } from './nav-items';
import { SIDE_PANEL_ID } from './SidePanel';

/** From this width the navigation is at the side and a panel can slide out next to it. */
const SIDE_NAV_QUERY = '(min-width: 768px)';

/** Reads the current path on the client and hands it to AppShell, with the side panel's state. */
export function AppShellClient({
  viewer,
  badges,
  linkAs,
  panels,
  hideNav,
  children,
}: {
  viewer: Viewer;
  badges?: Partial<Record<NavItem['key'], ReactNode>>;
  linkAs?: Partial<Record<NavItem['key'], ComponentType<ComponentProps<'a'>>>>;
  panels?: AppShellProps['panels'];
  hideNav?: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  // A panel belongs to the page it was opened on: moving to another path closes it.
  const [opened, setOpened] = useState<{ key: PanelKey; path: string } | null>(null);
  const open = opened !== null && opened.path === path ? opened.key : null;

  const close = useCallback((returnFocusTo?: PanelKey) => {
    setOpened(null);
    if (returnFocusTo) {
      document
        .querySelector<HTMLElement>(`nav[data-nav="side"] [data-panel="${returnFocusTo}"]`)
        ?.focus();
    }
  }, []);

  const onPanelClick = useCallback(
    (key: PanelKey, e: MouseEvent<HTMLAnchorElement>) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      if (!window.matchMedia(SIDE_NAV_QUERY).matches) return;
      e.preventDefault();
      if (open === key) close(key);
      else setOpened({ key, path });
    },
    [open, close, path],
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      // A modal dialog over the page takes the Escape key first.
      if (document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]')) return;
      close(open);
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (target?.closest(`#${SIDE_PANEL_ID}, nav[data-nav="side"]`)) return;
      close();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onPointer);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onPointer);
    };
  }, [open, close]);

  return (
    <AppShell
      currentPath={path}
      viewer={viewer}
      badges={badges}
      linkAs={linkAs}
      panels={panels}
      openPanel={open}
      onPanelClick={onPanelClick}
      hideNav={hideNav ?? isAuthScreen(path)}
    >
      {children}
    </AppShell>
  );
}
