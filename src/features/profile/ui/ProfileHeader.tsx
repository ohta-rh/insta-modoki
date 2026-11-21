import type { ReactNode } from 'react';
import type { ProfileView } from '../model/schema';
import { EditProfileLink } from './EditProfileLink';

/**
 * The profile's top: avatar (or the first letter in a circle), the names, the bio and the three
 * counts. The follower and following counts link to their lists. `actions` is the slot beside the
 * names (the follow button, filled by the route); when it is empty your own profile gets the edit
 * link. `followerCount` replaces the follower number, so the button's optimistic update moves it.
 */
export function ProfileHeader({
  profile,
  actions,
  followerCount,
}: {
  profile: ProfileView;
  actions?: ReactNode;
  followerCount?: ReactNode;
}) {
  const counts = [
    { label: '投稿', value: profile.postCount, href: null },
    {
      label: 'フォロワー',
      value: followerCount ?? profile.followerCount,
      href: `/${profile.username}/followers`,
    },
    {
      label: 'フォロー中',
      value: profile.followingCount,
      href: `/${profile.username}/following`,
    },
  ];
  return (
    <header className="flex gap-4 px-4 py-5 md:gap-10 md:py-8">
      {profile.avatarUrl ? (
        <img
          src={profile.avatarUrl}
          alt=""
          width={150}
          height={150}
          className="h-[77px] w-[77px] shrink-0 rounded-full bg-surface object-cover md:h-[150px] md:w-[150px]"
        />
      ) : (
        <span
          data-testid="avatar-initial"
          aria-hidden="true"
          className="flex h-[77px] w-[77px] shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-xl)] font-bold text-text-secondary md:h-[150px] md:w-[150px] md:text-[48px]"
        >
          {Array.from(profile.username)[0]?.toUpperCase()}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h1 className="truncate text-[length:var(--font-size-lg)] font-bold">
              {profile.displayName}
            </h1>
            <p className="truncate text-[length:var(--font-size-sm)] text-text-secondary">
              @{profile.username}
            </p>
          </div>
          {actions ?? (profile.isMe ? <EditProfileLink /> : null)}
        </div>
        <ul className="mt-3 flex gap-5 text-[length:var(--font-size-sm)]">
          {counts.map((c) => (
            <li key={c.label}>
              {c.href ? (
                <a href={c.href} className="inline-flex min-h-[var(--tap-min)] items-center">
                  <span className="font-bold">{c.value}</span>&nbsp;{c.label}
                </a>
              ) : (
                <span className="inline-flex min-h-[var(--tap-min)] items-center">
                  <span className="font-bold">{c.value}</span>&nbsp;{c.label}
                </span>
              )}
            </li>
          ))}
        </ul>
        {profile.bio !== '' && (
          <p className="mt-3 text-[length:var(--font-size-sm)] break-words whitespace-pre-wrap">
            {profile.bio}
          </p>
        )}
      </div>
    </header>
  );
}
