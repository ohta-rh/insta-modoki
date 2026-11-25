import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { listFollowing } from '@/features/follow';
import { FollowList } from '@/features/follow/ui';
import { AppError } from '@/shared/errors';

// Anyone may read the list, so this route is outside the (app) group (ADR-0031). The page and
// generateMetadata share one read per request.
const load = cache(async (username: string) => {
  try {
    return await listFollowing({ username });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
});

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username.toLowerCase()} のフォロー中` };
}

export default async function FollowingPage({ params }: Props) {
  const { username } = await params;
  const page = await load(username);
  const name = username.toLowerCase();
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)]">
      <header className="flex items-center gap-2 px-4 py-3">
        <a
          href={`/${name}`}
          className="inline-flex min-h-[var(--tap-min)] items-center text-[length:var(--font-size-sm)] font-bold underline"
        >
          @{name}
        </a>
        <h1 className="text-[length:var(--font-size-lg)] font-bold">フォロー中</h1>
      </header>
      <FollowList
        username={name}
        kind="following"
        initialItems={page.items}
        initialCursor={page.nextCursor}
      />
    </div>
  );
}
