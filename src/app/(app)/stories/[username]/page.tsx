import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getStoryReel } from '@/features/story';
import { StoryViewer } from '@/features/story/ui';
import { AppError } from '@/shared/errors';

// The viewer as a page of its own: a direct load or a reload of /stories/<username>.
export default async function StoryPage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  try {
    const reel = await getStoryReel({ username }, { headers: await headers() });
    return <StoryViewer key={reel.user.username} reel={reel} mode="page" />;
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
}
