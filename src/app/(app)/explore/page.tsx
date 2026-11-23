import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { listExplorePosts } from '@/features/explore';
import { ExplorePage } from '@/features/explore/ui';
import { AppError } from '@/shared/errors';

export const metadata: Metadata = { title: '発見 | Mado（仮称）' };

// The first page is read here, the rest by the grid's Server Action. The (app) layout already
// sends a visitor to the login screen; listExplorePosts enforces the session again.
export default async function ExploreRoute() {
  let page;
  try {
    page = await listExplorePosts({}, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    throw error;
  }
  return <ExplorePage initialItems={page.items} initialCursor={page.nextCursor} />;
}
