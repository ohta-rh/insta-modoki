import { formatRelativeTime } from '../../../shared/time/relative-time';
import { notificationText } from '../model/notification-text';
import type { NotificationView } from '../model/schema';

/** Where the whole row goes: a like or comment to the post, a follow to the person. */
export function notificationHref(view: NotificationView): string {
  return view.type === 'follow' || !view.post ? `/${view.actor.username}` : `/p/${view.post.id}`;
}

/**
 * One notification: the whole row is one link. A row not read yet says "新着" in words and has a
 * mark on the left (so the state is not colour alone).
 */
export function NotificationItem({ view, now }: { view: NotificationView; now: number }) {
  const cover = view.post?.cover ?? null;
  return (
    <li>
      <a
        href={notificationHref(view)}
        data-unread={view.read ? undefined : 'true'}
        className={`flex min-h-[var(--tap-min)] items-center gap-3 border-l-4 px-4 py-3 hover:bg-surface ${
          view.read ? 'border-transparent' : 'border-indigo'
        }`}
      >
        {view.actor.avatarUrl ? (
          <img
            src={view.actor.avatarUrl}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 shrink-0 rounded-full bg-surface object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface font-bold text-text"
          >
            {Array.from(view.actor.username)[0]?.toUpperCase()}
          </span>
        )}
        <span className="min-w-0 flex-1 text-[length:var(--font-size-sm)]">
          <span className="block break-words">{notificationText(view)}</span>
          <span className="flex items-center gap-2 text-text-secondary">
            <time dateTime={view.createdAt}>
              {formatRelativeTime(new Date(view.createdAt), now)}
            </time>
            {view.read ? null : <span className="font-bold text-text">新着</span>}
          </span>
        </span>
        {cover ? (
          <img
            src={cover.srcset.w320}
            srcSet={`${cover.srcset.w320} 320w, ${cover.srcset.w640} 640w`}
            sizes="44px"
            width={44}
            height={44}
            alt={cover.altText}
            loading="lazy"
            decoding="async"
            className="h-11 w-11 shrink-0 rounded-md bg-surface object-cover"
          />
        ) : null}
      </a>
    </li>
  );
}
