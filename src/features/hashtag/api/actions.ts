'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import type { Page, PostTile } from '../../post';
import { listTagPosts } from './list-tag-posts';

export type ListTagPostsResult =
  { ok: true; page: Page<PostTile> } | { ok: false; error: ErrorBody };

/** The Server Action the tag grid calls for the next page; it returns the error body instead of throwing. */
export async function listTagPostsAction(input: {
  tag: unknown;
  cursor: unknown;
}): Promise<ListTagPostsResult> {
  try {
    const { items, nextCursor } = await listTagPosts(input, { headers: await headers() });
    return { ok: true, page: { items, nextCursor } };
  } catch (error) {
    return failure('listTagPosts', error);
  }
}
