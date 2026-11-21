'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { failure, logUnexpected } from '../../../shared/action';
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
    return failure('listProfilePosts', error);
  }
}

export type UpdateProfileResult =
  { ok: true; profile: ProfileView } | { ok: false; error: ErrorBody };

/** The Server Action the edit form calls; it returns the error body instead of throwing. */
export async function updateProfileAction(input: unknown): Promise<UpdateProfileResult> {
  try {
    return { ok: true, profile: await updateProfile(input, { headers: await headers() }) };
  } catch (error) {
    return failure('updateProfile', error);
  }
}

export type EditFormState = {
  message: string;
  fieldErrors: Record<string, string[]>;
  /** What was submitted, so the screen shows it again next to the message. */
  values: { displayName: string; bio: string };
} | null;

const asText = (v: FormDataEntryValue | null): string => (typeof v === 'string' ? v : '');

/**
 * The edit form's own submit, so 保存 works before any script has loaded: the browser posts the
 * form, a good save redirects to the profile, a refusal re-renders the form with the messages
 * and what was typed. The JS-enhanced path (new icon) calls `updateProfileAction` instead.
 */
export async function updateProfileFormAction(
  _previous: EditFormState,
  formData: FormData,
): Promise<EditFormState> {
  const displayName = asText(formData.get('displayName'));
  const bio = asText(formData.get('bio'));
  const avatarKey = asText(formData.get('avatarKey'));
  let username: string;
  try {
    ({ username } = await updateProfile(
      { displayName, bio, avatarKey: avatarKey === '' ? undefined : avatarKey },
      { headers: await headers() },
    ));
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    logUnexpected('updateProfile', error);
    const body = toErrorResponse(error).body;
    return {
      message: body.message,
      fieldErrors: body.fieldErrors ?? {},
      values: { displayName, bio },
    };
  }
  redirect(`/${username}`);
}
