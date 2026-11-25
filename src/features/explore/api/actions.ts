'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import type { Page, PostTile } from '../../post';
import { listExplorePosts } from './list-explore-posts';

export type ListExplorePostsResult =
  { ok: true; page: Page<PostTile> } | { ok: false; error: ErrorBody };

/** The Server Action the discover grid calls for the next page; it returns the error body instead of throwing. */
export async function listExplorePostsAction(input: {
  cursor: unknown;
}): Promise<ListExplorePostsResult> {
  try {
    const { items, nextCursor } = await listExplorePosts(input, { headers: await headers() });
    return { ok: true, page: { items, nextCursor } };
  } catch (error) {
    return failure('listExplorePosts', error);
  }
}
