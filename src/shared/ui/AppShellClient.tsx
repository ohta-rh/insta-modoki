'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import { isAuthScreen, type NavItem, type Viewer } from './nav-items';

/** Reads the current path on the client and hands it to AppShell. */
export function AppShellClient({
  viewer,
  badges,
  hideNav,
  children,
}: {
  viewer: Viewer;
  badges?: Partial<Record<NavItem['key'], ReactNode>>;
  hideNav?: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  return (
    <AppShell
      currentPath={path}
      viewer={viewer}
      badges={badges}
      hideNav={hideNav ?? isAuthScreen(path)}
    >
      {children}
    </AppShell>
  );
}
