import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getStoryReel } from '@/features/story';
import { StoryMissing, StoryViewer } from '@/features/story/ui';
import { AppError } from '@/shared/errors';

// `(.)stories` intercepts /stories/<username> when it is reached from a screen of this group
// (the tray's link is a soft navigation). A direct load or a reload skips this file and gets the
// full-screen page next to it.
export default async function StoryModalPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  try {
    const reel = await getStoryReel({ username }, { headers: await headers() });
    return <StoryViewer key={reel.user.username} reel={reel} mode="modal" />;
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    if (error instanceof AppError && error.code === 'NOT_FOUND') {
      return <StoryMissing message={error.message} />;
    }
    throw error;
  }
}
