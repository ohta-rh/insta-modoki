'use server';

import { headers } from 'next/headers';
import { failure, formFailure } from '../../../shared/action';
import { AppError, type ErrorBody } from '../../../shared/errors';
import { follow } from './follow';
import type { FollowPage } from './list-follow';
import { listFollowers } from './list-followers';
import { listFollowing } from './list-following';
import { unfollow } from './unfollow';

export type FollowActionResult =
  { ok: true; following: boolean; followerCount: number } | { ok: false; error: ErrorBody };
export type FollowListActionResult =
  { ok: true; page: FollowPage } | { ok: false; error: ErrorBody };

/**
 * The Server Action the follow button calls once the page is hydrated: it puts the follow into the
 * state `following` ("make it so", so a resend is harmless) and returns the state after. It never
 * throws to the client; it returns the error body.
 */
export async function followAction(input: {
  username: unknown;
  following: unknown;
}): Promise<FollowActionResult> {
  try {
    const { username, following } = (input ?? {}) as { username?: unknown; following?: unknown };
    if (typeof following !== 'boolean') throw new AppError('VALIDATION');
    const run = following ? follow : unfollow;
    return { ok: true, ...(await run({ username }, { headers: await headers() })) };
  } catch (error) {
    return failure('follow', error);
  }
}

/**
 * The `<form action>` of the follow button. It works before the page is hydrated: the browser posts
 * the form (`username` and `follow` = "1" or "0", the wanted state) and the page is rendered again.
 * A visitor who is not signed in goes to the login page.
 */
export async function followFormAction(formData: FormData): Promise<void> {
  try {
    const username = formData.get('username');
    const run = formData.get('follow') === '1' ? follow : unfollow;
    await run({ username }, { headers: await headers() });
  } catch (error) {
    formFailure(error, 'follow');
  }
}

export async function listFollowersAction(input: unknown): Promise<FollowListActionResult> {
  try {
    return { ok: true, page: await listFollowers(input) };
  } catch (error) {
    return failure('listFollowers', error);
  }
}

export async function listFollowingAction(input: unknown): Promise<FollowListActionResult> {
  try {
    return { ok: true, page: await listFollowing(input) };
  } catch (error) {
    return failure('listFollowing', error);
  }
}
