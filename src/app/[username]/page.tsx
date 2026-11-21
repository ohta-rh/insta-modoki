import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getSessionUser } from '@/features/auth';
import { FollowButton, FollowerCount, FollowScope } from '@/features/follow';
import {
  getProfile,
  listProfilePosts,
  PostGrid,
  ProfileEmptyState,
  ProfileHeader,
} from '@/features/profile';
import { AppError } from '@/shared/errors';

// Anyone may open a profile, so this route is outside the (app) group (ADR-0031). The reserved
// names (accounts, p, create ...) have their own routes, which win over this one. The page and
// generateMetadata share one read per request; it is built per viewer and never cached.
const loadProfile = cache(async (username: string) => {
  try {
    return await getProfile({ username }, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
});

type Props = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  return { title: `${profile.displayName}（@${profile.username}）` };
}

export default async function ProfilePage({ params }: Props) {
  const { username } = await params;
  const profile = await loadProfile(username);
  const posts =
    profile.postCount > 0 ? await listProfilePosts({ username: profile.username }) : null;
  // Someone else's profile gets the follow button; your own keeps the edit link (ProfileHeader).
  const viewer = profile.isMe ? null : await getSessionUser(await headers());
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)]">
      {profile.isMe ? (
        <ProfileHeader profile={profile} />
      ) : (
        <FollowScope
          username={profile.username}
          initialFollowing={profile.isFollowing}
          initialFollowerCount={profile.followerCount}
          signedIn={viewer !== null}
        >
          <ProfileHeader
            profile={profile}
            actions={<FollowButton />}
            followerCount={<FollowerCount />}
          />
        </FollowScope>
      )}
      {posts && posts.items.length > 0 ? (
        <PostGrid
          username={profile.username}
          initialItems={posts.items}
          initialCursor={posts.nextCursor}
        />
      ) : (
        <ProfileEmptyState isMe={profile.isMe} />
      )}
    </div>
  );
}
