import { createElement, type ReactNode } from 'react';
import type { PostView } from '../../post';
import { FeedPostCard } from './FeedPostCard';

/** A post's card, already rendered by the server, with the post id that keeps a post from being listed twice. */
export type FeedCard = { id: string; node: ReactNode };

/**
 * Renders the cards on the server (the first page in the route, later pages in the Server Action),
 * so the browser gets the cards and not the code that builds them: the post, like and comment
 * slices' server code never reaches the home page's script. `firstPriority` loads the first
 * photo eagerly (only the very first card of the screen).
 */
export function renderFeedCards(
  posts: PostView[],
  options: { now: number; firstPriority: boolean },
): FeedCard[] {
  return posts.map((post, i) => ({
    id: post.id,
    node: createElement(FeedPostCard, {
      post,
      now: options.now,
      priority: options.firstPriority && i === 0,
    }),
  }));
}
