'use server';

import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import { follow } from './follow';
import type { FollowPage } from './list-follow';
import { listFollowers } from './list-followers';
import { listFollowing } from './list-following';
import { unfollow } from './unfollow';

export type FollowActionResult =
  { ok: true; following: boolean; followerCount: number } | { ok: false; error: ErrorBody };
export type FollowListActionResult =
  { ok: true; page: FollowPage } | { ok: false; error: ErrorBody };

const failure = (error: unknown, name: string) => {
  if (!(error instanceof AppError)) {
    console.error(`${name} failed`, error instanceof Error ? error.name : 'unknown');
  }
  return { ok: false as const, error: toErrorResponse(error).body };
};

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
    return failure(error, 'follow');
  }
}

/**
 * The `<form action>` of the follow button. It works before the page is hydrated: the browser posts
 * the form (`username` and `follow` = "1" or "0", the wanted state) and the page is rendered again.
 * A visitor who is not signed in goes to the login page.
 */
export async function followFormAction(formData: FormData): Promise<void> {
  let outcome: 'done' | 'login' | 'missing' = 'done';
  try {
    const username = formData.get('username');
    const run = formData.get('follow') === '1' ? follow : unfollow;
    await run({ username }, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') outcome = 'login';
    else if (error instanceof AppError && error.code === 'NOT_FOUND') outcome = 'missing';
    else throw error instanceof AppError ? error : new Error('follow failed');
  }
  if (outcome === 'login') redirect('/accounts/login');
  if (outcome === 'missing') notFound();
}

export async function listFollowersAction(input: unknown): Promise<FollowListActionResult> {
  try {
    return { ok: true, page: await listFollowers(input) };
  } catch (error) {
    return failure(error, 'listFollowers');
  }
}

export async function listFollowingAction(input: unknown): Promise<FollowListActionResult> {
  try {
    return { ok: true, page: await listFollowing(input) };
  } catch (error) {
    return failure(error, 'listFollowing');
  }
}
