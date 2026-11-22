import type { UserSummary } from '../../post';

/**
 * The first item of the tray: the viewer's avatar with a "+" mark, a plain link to the composer.
 * It is an `<a>`, not `next/link`, so the viewer's intercepting route never sees `create`.
 */
export function AddStoryButton({ me }: { me: UserSummary | null }) {
  return (
    <a
      href="/stories/create"
      className="group relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] w-[72px] shrink-0 flex-col items-center gap-1 text-center"
    >
      <span className="sr-only">ストーリーを追加</span>
      <span
        aria-hidden="true"
        className="relative flex h-[70px] w-[70px] items-center justify-center rounded-full motion-safe:transition-transform motion-safe:group-hover:scale-105"
      >
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-surface">
          {me?.avatarUrl ? (
            <img
              src={me.avatarUrl}
              alt=""
              width={64}
              height={64}
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
      <span aria-hidden="true" className="w-full truncate text-xs text-text-secondary">
        追加
      </span>
    </a>
  );
}
