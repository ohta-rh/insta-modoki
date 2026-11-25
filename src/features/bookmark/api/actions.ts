'use server';

import { headers } from 'next/headers';
import { failure, formFailure } from '../../../shared/action';
import { AppError, type ErrorBody } from '../../../shared/errors';
import type { Page, PostTile } from '../../post';
import { listSavedPosts } from './list-saved-posts';
import { savePost } from './save-post';
import { unsavePost } from './unsave-post';

export type SaveActionResult = { ok: true; saved: boolean } | { ok: false; error: ErrorBody };
export type SavedPostsActionResult =
  { ok: true; page: Page<PostTile> } | { ok: false; error: ErrorBody };

/**
 * The Server Action the save button calls once the page is hydrated: it puts the save into the
 * state `saved` ("make it so", so a resend is harmless) and returns the state after. It never
 * throws to the client; it returns the error body.
 */
export async function saveAction(input: {
  postId: unknown;
  saved: unknown;
}): Promise<SaveActionResult> {
  try {
    const { postId, saved } = (input ?? {}) as { postId?: unknown; saved?: unknown };
    if (typeof saved !== 'boolean') throw new AppError('VALIDATION');
    const run = saved ? savePost : unsavePost;
    return { ok: true, ...(await run({ postId }, { headers: await headers() })) };
  } catch (error) {
    return failure('save', error);
  }
}

/**
 * The `<form action>` of the save button. It works before the page is hydrated: the browser posts
 * the form (`postId` and `save` = "1" or "0", the wanted state) and the page is rendered again.
 * A visitor who is not signed in goes to the login page.
 */
export async function saveFormAction(formData: FormData): Promise<void> {
  try {
    const postId = formData.get('postId');
    const run = formData.get('save') === '1' ? savePost : unsavePost;
    await run({ postId }, { headers: await headers() });
  } catch (error) {
    formFailure(error, 'save');
  }
}

export async function listSavedPostsAction(input: unknown): Promise<SavedPostsActionResult> {
  try {
    return { ok: true, page: await listSavedPosts(input, { headers: await headers() }) };
  } catch (error) {
    return failure('listSavedPosts', error);
  }
}
