'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import { deletePost } from './delete-post';

export type DeletePostResult = { ok: true } | { ok: false; error: ErrorBody };

/** The Server Action the browser calls; it never throws to the client, it returns the error body. */
export async function deletePostAction(input: unknown): Promise<DeletePostResult> {
  try {
    await deletePost(input, { headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure('deletePost', error);
  }
}
