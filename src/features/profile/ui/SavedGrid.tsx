'use client';

import { listSavedPostsAction } from '../../bookmark';
import { type PostTile } from '../../post';
import { PostTileGrid } from '../../post/ui';
import { useDeletedPosts } from './ProfilePostsProvider';

/**
 * The profile's "保存済み" grid: the post slice's tile grid fed by the saved list. It lives in the
 * profile slice, not in bookmark: the feed imports the bookmark entry for the save button, and a
 * bookmark entry that reached the profile entry would put the profile's code in the feed's
 * bundle. A tile opens the post in the profile's modal (ADR-0043); a post deleted in that modal
 * leaves the grid at once.
 */
export function SavedGrid({
  initialItems,
  initialCursor,
}: {
  initialItems: PostTile[];
  initialCursor: string | null;
}) {
  return (
    <PostTileGrid
      label="保存済み"
      emptyText="保存した投稿はまだありません"
      initialItems={initialItems}
      initialCursor={initialCursor}
      load={(cursor) => listSavedPostsAction({ cursor })}
      hiddenIds={useDeletedPosts().ids}
    />
  );
}
