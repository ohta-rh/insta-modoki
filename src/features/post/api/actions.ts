'use server';

import { headers } from 'next/headers';
import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import { deletePost } from './delete-post';

export type DeletePostResult = { ok: true } | { ok: false; error: ErrorBody };

/** The Server Action the browser calls; it never throws to the client, it returns the error body. */
export async function deletePostAction(input: unknown): Promise<DeletePostResult> {
  try {
    await deletePost(input, { headers: await headers() });
    return { ok: true };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('deletePost failed', error instanceof Error ? error.name : 'unknown');
    }
    return { ok: false, error: toErrorResponse(error).body };
  }
}
