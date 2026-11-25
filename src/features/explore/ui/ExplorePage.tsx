'use client';

import { type PostTile } from '../../post';
import { PostTileGrid } from '../../post/ui';
import { listExplorePostsAction } from '../api/actions';
import { SearchLink } from './SearchLink';

/**
 * The discover tab: a link to the user search (narrow screens only: from 768px the nav's panel has it), then the grid of last week's most liked posts
 * from people the viewer does not follow. A client component, because the grid's `load` is a
 * function (a Server Action wrapped to take the cursor), which a server component cannot pass down.
 */
export function ExplorePage({
  initialItems,
  initialCursor,
}: {
  initialItems: PostTile[];
  initialCursor: string | null;
}) {
  return (
    <div data-page-width="wide" className="mx-auto w-full max-w-[var(--site-width-wide)] nav:pt-4">
      <h1 className="sr-only">発見</h1>
      <div className="nav:hidden">
        <SearchLink />
      </div>
      <PostTileGrid
        label="人気の投稿"
        initialItems={initialItems}
        initialCursor={initialCursor}
        load={(cursor) => listExplorePostsAction({ cursor })}
        emptyText="まだ人気の投稿がありません"
      />
    </div>
  );
}
