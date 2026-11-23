import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { searchUsers } from '@/features/search';
import { SearchPage } from '@/features/search/ui';
import { AppError } from '@/shared/errors';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// The result of `?q=` is read here, so a plain form GET works before any script loads. It goes
// through the same `searchUsers` (and the same rate limit) as the box's Server Action.
export default async function ExploreSearchPage({ searchParams }: Props) {
  const { q } = await searchParams;
  if (typeof q !== 'string' || q.trim() === '') return <SearchPage />;
  try {
    const { items } = await searchUsers({ q }, { headers: await headers() });
    return <SearchPage q={q.trim()} items={items} />;
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    if (
      error instanceof AppError &&
      (error.code === 'VALIDATION' || error.code === 'RATE_LIMITED')
    ) {
      return <SearchPage q={q} error={error.message} />;
    }
    throw error;
  }
}
