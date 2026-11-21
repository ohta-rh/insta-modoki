import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { getSessionUser } from '@/features/auth';

// Every screen that needs a session lives under this route group (ADR-0031).
// Their URLs are listed in features/auth/model/protected-paths.ts.
export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser(await headers());
  if (!user) redirect('/accounts/login');
  return children;
}
