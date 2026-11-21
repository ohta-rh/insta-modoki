'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import { renderFeedCards, type FeedCard } from '../ui/feed-cards';
import { getFeed } from './get-feed';

export type GetFeedResult =
  { ok: true; cards: FeedCard[]; nextCursor: string | null } | { ok: false; error: ErrorBody };

/**
 * The Server Action the feed calls for the next page. It returns the page's cards, rendered, and
 * the error body instead of throwing.
 */
export async function getFeedAction(input: unknown): Promise<GetFeedResult> {
  try {
    const page = await getFeed(input, { headers: await headers() });
    const cards = renderFeedCards(page.items, { now: Date.now(), firstPriority: false });
    return { ok: true, cards, nextCursor: page.nextCursor };
  } catch (error) {
    return failure('getFeed', error);
  }
}
