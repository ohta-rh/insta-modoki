import { headers } from 'next/headers';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Feed, getFeed, renderFeedCards } from '@/features/feed';
import { StoryTrayFallback, StoryTraySection } from '@/features/story';
import { AppError } from '@/shared/errors';

// The home feed: the first page is read here, the rest by the Feed's Server Action. The (app)
// layout already sends a visitor to the login screen; getFeed enforces the session again.
export default async function HomePage() {
  let page;
  try {
    page = await getFeed({}, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    throw error;
  }
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)] py-4">
      <h1 className="sr-only">ホーム</h1>
      <Suspense fallback={<StoryTrayFallback />}>
        <StoryTraySection />
      </Suspense>
      <Feed
        initialCards={renderFeedCards(page.items, { now: Date.now(), firstPriority: true })}
        initialCursor={page.nextCursor}
      />
    </div>
  );
}
