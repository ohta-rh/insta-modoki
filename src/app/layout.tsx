import { headers } from 'next/headers';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getSessionUser, isValidUsernameFormat } from '@/features/auth';
import { NotificationBadge, NotificationNavLink } from '@/features/notification/ui';
import { AppShellClient, HydrationMarker } from '@/shared/ui';
import './globals.css';

export const metadata = {
  title: 'Mado（仮称）',
  icons: { icon: '/brand/favicon.svg' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render every route per request so it gets the CSP nonce from src/proxy.ts (ADR-0026).
  await connection();
  const user = await getSessionUser(await headers());
  // Only a username that passes the format check reaches the navigation links.
  const viewer = user && isValidUsernameFormat(user.username) ? { username: user.username } : null;
  return (
    <html lang="ja">
      <body>
        <HydrationMarker />
        <AppShellClient
          viewer={viewer}
          badges={viewer ? { notifications: <NotificationBadge /> } : undefined}
          linkAs={viewer ? { notifications: NotificationNavLink } : undefined}
        >
          {children}
        </AppShellClient>
      </body>
    </html>
  );
}
