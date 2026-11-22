'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import type { Page, UserSummary } from '../../post';
import { createStory } from './create-story';
import { listStoryViewers } from './list-story-viewers';
import { markStoryViewed } from './mark-story-viewed';
import { requestStoryUpload, type StoryUploadSlot } from './request-story-upload';

export type RequestStoryUploadResult =
  ({ ok: true } & StoryUploadSlot) | { ok: false; error: ErrorBody };
export type CreateStoryResult = { ok: true; storyId: string } | { ok: false; error: ErrorBody };

/** The Server Actions the browser calls; they never throw to the client, they return the error body. */
export async function requestStoryUploadAction(input: unknown): Promise<RequestStoryUploadResult> {
  try {
    return { ok: true, ...(await requestStoryUpload(input, { headers: await headers() })) };
  } catch (error) {
    return failure('requestStoryUpload', error);
  }
}

export async function createStoryAction(input: unknown): Promise<CreateStoryResult> {
  try {
    const { storyId } = await createStory(input, { headers: await headers() });
    return { ok: true, storyId };
  } catch (error) {
    return failure('createStory', error);
  }
}

export type MarkStoryViewedResult = { ok: true } | { ok: false; error: ErrorBody };
export type StoryViewersResult =
  { ok: true; page: Page<UserSummary> } | { ok: false; error: ErrorBody };

export async function markStoryViewedAction(input: unknown): Promise<MarkStoryViewedResult> {
  try {
    await markStoryViewed(input, { headers: await headers() });
    return { ok: true };
  } catch (error) {
    return failure('markStoryViewed', error);
  }
}

export async function listStoryViewersAction(input: unknown): Promise<StoryViewersResult> {
  try {
    return { ok: true, page: await listStoryViewers(input, { headers: await headers() }) };
  } catch (error) {
    return failure('listStoryViewers', error);
  }
}
