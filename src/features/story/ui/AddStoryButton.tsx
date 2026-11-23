import type { UserSummary } from '../../post';

/**
 * The first item of the tray: the viewer's avatar with a "+" mark, a plain link to the composer.
 * It is an `<a>`, not `next/link`, so the viewer's intercepting route never sees `create`.
 */
export function AddStoryButton({ me }: { me: UserSummary | null }) {
  return (
    <a
      href="/stories/create"
      className="group relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] w-20 shrink-0 flex-col items-center gap-1 text-center"
    >
      <span className="sr-only">ストーリーを追加</span>
      <span
        aria-hidden="true"
        data-story-ring
        className="relative flex h-[66px] w-[66px] items-center justify-center rounded-full motion-safe:transition-transform motion-safe:group-hover:scale-105"
      >
        <span
          data-story-avatar
          className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-surface"
        >
          {me?.avatarUrl ? (
            <img
              src={me.avatarUrl}
              alt=""
              width={56}
              height={56}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-lg text-text-secondary">
              {me ? ([...me.displayName][0]?.toUpperCase() ?? '') : ''}
            </span>
          )}
        </span>
        <span className="absolute right-0 bottom-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-bg bg-link text-xs leading-none font-bold text-white">
          +
        </span>
      </span>
      <span
        aria-hidden="true"
        data-story-name
        className="w-full truncate px-1 text-[length:var(--font-size-xs)] text-text"
      >
        追加
      </span>
    </a>
  );
}
