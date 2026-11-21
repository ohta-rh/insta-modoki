import { connection } from 'next/server';
import type { ReactNode } from 'react';
import { AppShellClient } from '@/shared/ui';
import './globals.css';

export const metadata = {
  title: 'Mado（仮称）',
  icons: { icon: '/brand/favicon.svg' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render every route per request so it gets the CSP nonce from src/proxy.ts (ADR-0026).
  await connection();
  return (
    <html lang="ja">
      <body>
        {/* viewer is passed by #26 once the session is readable. */}
        <AppShellClient viewer={null}>{children}</AppShellClient>
      </body>
    </html>
  );
}
