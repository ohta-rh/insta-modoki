import { headers } from 'next/headers';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getFeed } from '@/features/feed';
import { renderFeedCards } from '@/features/feed/ui';
import { Feed } from '@/features/feed/ui';
import { listSuggestedUsers } from '@/features/follow';
import { HomeAside } from '@/features/follow/ui';
import { getProfile } from '@/features/profile';
import { StoryTrayFallback, StoryTraySection } from '@/features/story/ui';
import { getSessionUser } from '@/features/auth';
import { logUnexpected } from '@/shared/action';
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
  const aside = await readAside(await headers());
  return (
    <div
      data-page-width="wide"
      className="mx-auto flex w-full justify-center gap-[var(--aside-gap)] py-4"
    >
      <div className="w-full max-w-[var(--content-max)] min-w-0">
        <h1 className="sr-only">ホーム</h1>
        <Suspense fallback={<StoryTrayFallback />}>
          <StoryTraySection />
        </Suspense>
        <Feed
          initialCards={renderFeedCards(page.items, { now: Date.now(), firstPriority: true })}
          initialCursor={page.nextCursor}
        />
      </div>
      {aside && <HomeAside me={aside.me} suggestions={aside.suggestions} />}
    </div>
  );
}

// The right column's data. A failed read must not take the feed down: it is logged by name and the
// column is left out.
async function readAside(requestHeaders: Headers) {
  try {
    const viewer = await getSessionUser(requestHeaders);
    if (!viewer) return null;
    const [me, suggested] = await Promise.all([
      getProfile({ username: viewer.username }, { headers: requestHeaders }),
      listSuggestedUsers({}, { headers: requestHeaders }),
    ]);
    return { me, suggestions: suggested.items };
  } catch (error) {
    logUnexpected('homeAside', error);
    return null;
  }
}
