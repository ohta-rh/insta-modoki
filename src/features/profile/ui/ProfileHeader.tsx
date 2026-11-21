import type { ReactNode } from 'react';
import type { ProfileView } from '../model/schema';

/**
 * The profile's top: avatar (or the first letter in a circle), the names, the bio and the three
 * counts. The counts are plain text here (the lists they open come with the follow PBI).
 * `actions` is the slot beside the names for the edit button (own profile) and the follow
 * button (someone else's); this slice renders nothing in it.
 */
export function ProfileHeader({ profile, actions }: { profile: ProfileView; actions?: ReactNode }) {
  const counts = [
    { label: '投稿', value: profile.postCount },
    { label: 'フォロワー', value: profile.followerCount },
    { label: 'フォロー中', value: profile.followingCount },
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
          {actions}
        </div>
        <ul className="mt-3 flex gap-5 text-[length:var(--font-size-sm)]">
          {counts.map((c) => (
            <li key={c.label}>
              <span className="font-bold">{c.value}</span> {c.label}
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
