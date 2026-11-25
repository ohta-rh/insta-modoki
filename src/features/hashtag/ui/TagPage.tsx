'use client';

import { type PostTile } from '../../post';
import { PostTileGrid } from '../../post/ui';
import { listTagPostsAction } from '../api/actions';

/** A tag's page: its name, how many posts carry it, and the grid of those posts (newest first). */
export function TagPage({
  name,
  postCount,
  initialItems,
  initialCursor,
}: {
  name: string;
  postCount: number;
  initialItems: PostTile[];
  initialCursor: string | null;
}) {
  return (
    <div data-page-width="wide" className="mx-auto w-full max-w-[var(--site-width-wide)] py-4">
      <header className="px-4 pb-4 nav:px-0">
        <h1 className="text-[length:var(--font-size-xl)] font-bold break-words">#{name}</h1>
        <p className="text-[length:var(--font-size-sm)] text-text-secondary">投稿 {postCount} 件</p>
      </header>
      <PostTileGrid
        label={`#${name} の投稿`}
        initialItems={initialItems}
        initialCursor={initialCursor}
        load={(cursor) => listTagPostsAction({ tag: name, cursor })}
        emptyText="まだ投稿がありません"
      />
    </div>
  );
}
