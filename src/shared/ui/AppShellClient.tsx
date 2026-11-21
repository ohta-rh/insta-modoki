'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { AppShell } from './AppShell';
import type { Viewer } from './nav-items';

/** Reads the current path on the client and hands it to AppShell. */
export function AppShellClient({
  viewer,
  hideNav,
  children,
}: {
  viewer: Viewer;
  hideNav?: boolean;
  children: ReactNode;
}) {
  return (
    <AppShell currentPath={usePathname()} viewer={viewer} hideNav={hideNav}>
      {children}
    </AppShell>
  );
}
