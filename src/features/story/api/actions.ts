'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import { createStory } from './create-story';
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
