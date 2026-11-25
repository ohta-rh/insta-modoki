import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/features/auth';

// Every screen that needs a session lives under this route group (ADR-0031).
// Their URLs are listed in features/auth/model/protected-paths.ts.
// `modal` is the slot the story viewer opens in over the page behind it (intercepting route, ADR-0043).
export default async function AppLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode;
}) {
  const user = await getSessionUser(await headers());
  if (!user) redirect('/accounts/login');
  return (
    <>
      {children}
      {modal}
    </>
  );
}
