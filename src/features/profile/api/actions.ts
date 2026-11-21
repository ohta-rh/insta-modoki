'use server';

import { headers } from 'next/headers';
import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import type { Page, PostThumb, ProfileView } from '../model/schema';
import { listProfilePosts } from './list-profile-posts';
import { updateProfile } from './update-profile';

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

export type UpdateProfileResult =
  { ok: true; profile: ProfileView } | { ok: false; error: ErrorBody };

/** The Server Action the edit form calls; it returns the error body instead of throwing. */
export async function updateProfileAction(input: unknown): Promise<UpdateProfileResult> {
  try {
    return { ok: true, profile: await updateProfile(input, { headers: await headers() }) };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('updateProfile failed', error instanceof Error ? error.name : 'unknown');
    }
    return { ok: false, error: toErrorResponse(error).body };
  }
}
