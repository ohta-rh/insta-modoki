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
  const avatar = profile.avatarUrl ? (
    <img
      src={profile.avatarUrl}
      alt=""
      width={150}
      height={150}
      className="h-[77px] w-[77px] shrink-0 rounded-full bg-surface object-cover nav:h-[150px] nav:w-[150px]"
    />
  ) : (
    <span
      data-testid="avatar-initial"
      aria-hidden="true"
      className="flex h-[77px] w-[77px] shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-xl)] font-bold text-text nav:h-[150px] nav:w-[150px] nav:text-[48px]"
    >
      {Array.from(profile.username)[0]?.toUpperCase()}
    </span>
  );
  // One DOM for both widths. From 768px: avatar in the left 30%, three rows on the right. Below:
  // the avatar and the first row, then the bio, then the counts in three equal cells under a line.
  return (
    <header className="grid max-nav:grid-cols-[auto_1fr] max-nav:pt-4 nav:grid-cols-[30%_1fr] nav:pb-11">
      <div className="flex justify-center max-nav:px-4 nav:row-span-3">{avatar}</div>
      <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 max-nav:pr-4 nav:col-start-2 nav:pr-4">
        <h1 className="min-w-0 break-all text-[length:var(--font-size-lg)] font-normal">
          {profile.username}
        </h1>
        {actions ?? (profile.isMe ? <EditProfileLink /> : null)}
      </div>
      <ul className="text-[length:var(--font-size-md)] max-nav:order-last max-nav:col-span-2 max-nav:mt-4 max-nav:grid max-nav:grid-cols-3 max-nav:border-t max-nav:border-border max-nav:py-3 max-nav:text-center nav:col-start-2 nav:mt-5 nav:flex nav:gap-10 nav:pr-4">
        {counts.map((c) => {
          const body = (
            <>
              <span className="font-semibold text-text">{c.value}</span>{' '}
              <span className="whitespace-nowrap text-text-secondary">{c.label}</span>
            </>
          );
          const cell =
            'flex min-h-[var(--tap-min)] flex-col items-center justify-center nav:flex-row nav:gap-1';
          return (
            <li key={c.label}>
              {c.href ? (
                <a href={c.href} className={cell}>
                  {body}
                </a>
              ) : (
                <span className={cell}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
      <div className="text-[length:var(--font-size-sm)] break-words max-nav:col-span-2 max-nav:mt-3 max-nav:px-4 nav:col-start-2 nav:mt-5 nav:pr-4">
        <p className="font-semibold">{profile.displayName}</p>
        {profile.bio !== '' && <p className="whitespace-pre-wrap">{profile.bio}</p>}
      </div>
    </header>
  );
}
