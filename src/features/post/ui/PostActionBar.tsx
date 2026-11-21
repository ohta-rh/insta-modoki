import type { ReactNode } from 'react';

/**
 * The row under the photos. The like button (#34) and the comment button (#35) are put in the
 * `like` and `comment` slots by the screen that composes the card. The row wraps, so a message
 * under the buttons (the like's error) has a line of its own.
 */
export function PostActionBar({ like, comment }: { like?: ReactNode; comment?: ReactNode }) {
  return (
    <div
      data-slot="post-actions"
      className="flex min-h-[var(--tap-min)] flex-wrap items-center gap-1 px-1"
    >
      {like}
      {comment}
    </div>
  );
}
