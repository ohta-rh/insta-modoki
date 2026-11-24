import type { UserSummary } from '../../post';
import { FOOTER_NOTICE } from '../../../shared/ui/brand';
import type { SuggestedUser } from '../model/schema';
import { FollowButton } from './FollowButton';
import { FollowScope } from './FollowScope';

function Avatar({ user, size }: { user: UserSummary; size: 32 | 44 }) {
  const box = size === 44 ? 'h-11 w-11' : 'h-8 w-8';
  return user.avatarUrl ? (
    <img
      src={user.avatarUrl}
      alt=""
      width={size}
      height={size}
      className={`${box} shrink-0 rounded-full bg-surface object-cover`}
    />
  ) : (
    <span
      aria-hidden="true"
      className={`${box} flex shrink-0 items-center justify-center rounded-full bg-surface font-semibold text-text`}
    >
      {Array.from(user.username)[0]?.toUpperCase()}
    </span>
  );
}

/**
 * The home's right column, drawn from 1160px up: the viewer's own row, "おすすめ" with up to five
 * people (reason and a follow word) and the page's footer, which moves here from the bottom of the
 * page (`globals.css` hides `[data-shell-footer]` while this footer is on the screen). With no
 * one to suggest, the heading and the list are left out. The viewer is always signed in here.
 */
export function HomeAside({ me, suggestions }: { me: UserSummary; suggestions: SuggestedUser[] }) {
  return (
    <aside
      aria-label="おすすめ"
      className="hidden aside:block w-[var(--aside-width)] shrink-0 pt-8 text-[length:var(--font-size-sm)]"
    >
      <a
        href={`/${me.username}`}
        className="flex min-h-[var(--tap-min)] items-center gap-3 rounded-lg"
      >
        <Avatar user={me} size={44} />
        <span className="min-w-0">
          <span className="block truncate font-semibold text-text">{me.username}</span>
          <span className="block truncate text-text-secondary">{me.displayName}</span>
        </span>
      </a>
      {suggestions.length > 0 && (
        <>
          <h2 className="mt-4 mb-2 text-[length:var(--font-size-sm)] font-semibold text-text-secondary">
            おすすめ
          </h2>
          <ul>
            {suggestions.map((s) => (
              <li key={s.username} className="flex min-h-[var(--tap-min)] items-center gap-3 py-1">
                <Avatar user={s} size={32} />
                <span className="min-w-0 flex-1">
                  <a
                    href={`/${s.username}`}
                    className="inline-tap-link block truncate font-semibold text-text"
                  >
                    {s.username}
                  </a>
                  <span className="block truncate text-[length:var(--font-size-xs)] text-text-secondary">
                    {s.reason}
                  </span>
                </span>
                <FollowScope
                  username={s.username}
                  initialFollowing={false}
                  initialFollowerCount={0}
                  signedIn
                >
                  <FollowButton variant="text" />
                </FollowScope>
              </li>
            ))}
          </ul>
        </>
      )}
      <footer
        data-aside-footer
        className="mt-8 text-[length:var(--font-size-xs)] text-text-secondary"
      >
        <p>© {new Date().getUTCFullYear()} Mado（仮称）</p>
        <p className="mt-1">{FOOTER_NOTICE}</p>
      </footer>
    </aside>
  );
}
