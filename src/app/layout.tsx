import { headers } from 'next/headers';
import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { getSessionUser, isValidUsernameFormat } from '@/features/auth';
import {
  NotificationBadge,
  NotificationNavLink,
  NotificationPanel,
} from '@/features/notification/ui';
import { CreateNavLink } from '@/features/post-create/ui';
import { SearchPanel } from '@/features/search/ui';
import { AppShellClient, HydrationMarker } from '@/shared/ui';
import './globals.css';

export const metadata = {
  title: 'Mado（仮称）',
  icons: { icon: '/brand/favicon.svg' },
};

// `modal` is the slot the create modal opens in over the current screen (src/app/@modal, ADR-0043).
export default async function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
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
          panels={
            viewer
              ? {
                  search: { title: '検索', content: <SearchPanel /> },
                  notifications: { title: '通知', content: <NotificationPanel /> },
                }
              : undefined
          }
          badges={
            viewer && user ? { notifications: <NotificationBadge viewerId={user.id} /> } : undefined
          }
          linkAs={
            viewer && user
              ? { notifications: NotificationNavLink, create: CreateNavLink }
              : undefined
          }
        >
          {children}
          {modal}
        </AppShellClient>
      </body>
    </html>
  );
}
