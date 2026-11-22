import type { ReactNode } from 'react';

/**
 * The row under the photos. The like button (#34), the comment button (#35) and the save
 * button (#51, pushed to the right end by its own `ml-auto`) are put in the `like`, `comment` and
 * `save` slots by the screen that composes the card. The row wraps, so a message
 * under the buttons (the like's error) has a line of its own.
 */
export function PostActionBar({
  like,
  comment,
  save,
}: {
  like?: ReactNode;
  comment?: ReactNode;
  save?: ReactNode;
}) {
  return (
    <div
      data-slot="post-actions"
      className="flex min-h-[var(--tap-min)] flex-wrap items-center gap-1 px-1"
    >
      {like}
      {comment}
      {save}
    </div>
  );
}
