'use server';

import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import type { Page, PostThumb } from '../model/schema';
import { listProfilePosts } from './list-profile-posts';

export type ListProfilePostsResult =
  { ok: true; page: Page<PostThumb> } | { ok: false; error: ErrorBody };

/** The Server Action the grid calls for the next page; it returns the error body instead of throwing. */
export async function listProfilePostsAction(input: unknown): Promise<ListProfilePostsResult> {
  try {
    return { ok: true, page: await listProfilePosts(input) };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('listProfilePosts failed', error instanceof Error ? error.name : 'unknown');
    }
    return { ok: false, error: toErrorResponse(error).body };
  }
}
