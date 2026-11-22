import { PostTileGrid, type PostTile } from '../../post';
import { listExplorePostsAction } from '../api/actions';
import { SearchLink } from './SearchLink';

/**
 * The discover tab: a link to the user search, then the grid of last week's most liked posts
 * from people the viewer does not follow. Only the grid is client code.
 */
export function ExplorePage({
  initialItems,
  initialCursor,
}: {
  initialItems: PostTile[];
  initialCursor: string | null;
}) {
  return (
    <div className="mx-auto w-full max-w-[var(--content-max)]">
      <h1 className="sr-only">発見</h1>
      <SearchLink />
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
