import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getSessionUser } from '@/features/auth';
import { listSavedPosts } from '@/features/bookmark';
import { FollowButton, FollowerCount, FollowScope } from '@/features/follow/ui';
import {
  getProfile,
  listProfilePosts,
  ProfileEmptyState,
  ProfileHeader,
  profileTab,
} from '@/features/profile';
import { PostGrid, ProfileTabs, SavedGrid } from '@/features/profile/ui';
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

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  return { title: `${profile.displayName}（@${profile.username}）` };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const profile = await loadProfile(username);
  // "saved" is private: only the owner's own profile can open it (profileTab), and then only the
  // owner's saves are read. Anyone else, and any other value, gets the posts tab.
  const tab = profileTab(profile.isMe, (await searchParams).tab);
  const saved = tab === 'saved' ? await listSavedPosts({}, { headers: await headers() }) : null;
  const posts =
    tab === 'posts' && profile.postCount > 0
      ? await listProfilePosts({ username: profile.username })
      : null;
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
      <ProfileTabs username={profile.username} isMe={profile.isMe} current={tab}>
        {saved ? (
          <SavedGrid initialItems={saved.items} initialCursor={saved.nextCursor} />
        ) : posts && posts.items.length > 0 ? (
          <PostGrid
            username={profile.username}
            initialItems={posts.items}
            initialCursor={posts.nextCursor}
          />
        ) : (
          <ProfileEmptyState isMe={profile.isMe} />
        )}
      </ProfileTabs>
    </div>
  );
}
