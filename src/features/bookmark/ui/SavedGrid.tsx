'use client';

import { PostTileGrid, type PostTile } from '../../post';
import { useDeletedPosts } from '../../profile';
import { listSavedPostsAction } from '../api/actions';

/**
 * The profile's "保存済み" grid: the post slice's tile grid fed by the saved list. A tile opens the
 * post in the profile's modal (ADR-0043); a post deleted in that modal leaves the grid at once.
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
