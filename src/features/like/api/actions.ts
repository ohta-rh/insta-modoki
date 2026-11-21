'use server';

import { headers } from 'next/headers';
import { failure, formFailure } from '../../../shared/action';
import { AppError, type ErrorBody } from '../../../shared/errors';
import { likePost } from './like-post';
import { listLikers, type LikersPage } from './list-likers';
import { unlikePost } from './unlike-post';

export type LikeActionResult =
  { ok: true; liked: boolean; likeCount: number } | { ok: false; error: ErrorBody };
export type LikersActionResult = { ok: true; page: LikersPage } | { ok: false; error: ErrorBody };

/**
 * The Server Action the like button calls once the page is hydrated: it puts the like into the
 * state `liked` ("make it so", so a resend is harmless) and returns the state after. It never
 * throws to the client; it returns the error body.
 */
export async function likeAction(input: {
  postId: unknown;
  liked: unknown;
}): Promise<LikeActionResult> {
  try {
    const { postId, liked } = (input ?? {}) as { postId?: unknown; liked?: unknown };
    if (typeof liked !== 'boolean') throw new AppError('VALIDATION');
    const run = liked ? likePost : unlikePost;
    return { ok: true, ...(await run({ postId }, { headers: await headers() })) };
  } catch (error) {
    return failure('like', error);
  }
}

/**
 * The `<form action>` of the like button. It works before the page is hydrated: the browser posts
 * the form (`postId` and `like` = "1" or "0", the wanted state) and the page is rendered again.
 * A visitor who is not signed in goes to the login page.
 */
export async function likeFormAction(formData: FormData): Promise<void> {
  try {
    const postId = formData.get('postId');
    const run = formData.get('like') === '1' ? likePost : unlikePost;
    await run({ postId }, { headers: await headers() });
  } catch (error) {
    formFailure(error, 'like');
  }
}

export async function listLikersAction(input: unknown): Promise<LikersActionResult> {
  try {
    return { ok: true, page: await listLikers(input) };
  } catch (error) {
    return failure('listLikers', error);
  }
}
