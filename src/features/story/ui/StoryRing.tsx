import type { UserSummary } from '../../post';

const UNSEEN = 'conic-gradient(var(--color-indigo), var(--color-link), var(--color-indigo))';
const SEEN = 'var(--color-text-muted)';

/**
 * A 64px round avatar inside a 3px ring: a gradient while there is something unseen, gray once
 * everything was seen. The state is also in the link's name, so the color is never the only cue.
 * The name belongs to the link, so the image is decorative (`alt=""`).
 */
export function StoryRing({ user, unseen }: { user: UserSummary; unseen: boolean }) {
  return (
    <span
      aria-hidden="true"
      className="flex h-[70px] w-[70px] items-center justify-center rounded-full motion-safe:transition-transform motion-safe:group-hover:scale-105"
      style={{ background: unseen ? UNSEEN : SEEN }}
    >
      <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 border-bg bg-surface">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt=""
            width={60}
            height={60}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-lg text-text-secondary">
            {[...user.displayName][0]?.toUpperCase() ?? ''}
          </span>
        )}
      </span>
    </span>
  );
}
