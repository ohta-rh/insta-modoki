'use server';

import { headers } from 'next/headers';
import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import { createPost } from './create-post';

export type CreatePostResult = { ok: true; postId: string } | { ok: false; error: ErrorBody };

/** The Server Action the browser calls; it never throws to the client, it returns the error body. */
export async function createPostAction(input: unknown): Promise<CreatePostResult> {
  try {
    const { postId } = await createPost(input, { headers: await headers() });
    return { ok: true, postId };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('createPost failed', error instanceof Error ? error.name : 'unknown');
    }
    return { ok: false, error: toErrorResponse(error).body };
  }
}
