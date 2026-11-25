import type { UserSummary } from '../../post';

/**
 * A 56px round avatar in a 66px ring: the own gradient (`--gradient-window`, ADR-0056) with a 2px
 * white gap while there is something unseen, a 1px gray ring once everything was seen. The state
 * is also in the link's name, so the color is never the only cue. The name belongs to the link,
 * so the image is decorative (`alt=""`).
 */
export function StoryRing({ user, unseen }: { user: UserSummary; unseen: boolean }) {
  const avatar = (
    <span
      data-story-avatar
      className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface"
    >
      {user.avatarUrl ? (
        <img
          src={user.avatarUrl}
          alt=""
          width={56}
          height={56}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-lg text-text-secondary">
          {[...user.displayName][0]?.toUpperCase() ?? ''}
        </span>
      )}
    </span>
  );
  return (
    <span
      aria-hidden="true"
      data-story-ring
      className="flex h-[66px] w-[66px] shrink-0 items-center justify-center rounded-full motion-safe:transition-transform motion-safe:group-hover:scale-105"
      style={
        unseen
          ? { background: 'var(--gradient-window)', padding: 3 }
          : { boxShadow: 'inset 0 0 0 1px var(--color-border)' }
      }
    >
      {unseen ? (
        <span className="flex h-[60px] w-[60px] items-center justify-center rounded-full border-2 border-bg bg-bg">
          {avatar}
        </span>
      ) : (
        avatar
      )}
    </span>
  );
}
