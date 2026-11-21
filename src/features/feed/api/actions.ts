'use server';

import { headers } from 'next/headers';
import { AppError, toErrorResponse, type ErrorBody } from '../../../shared/errors';
import type { PostView } from '../../post';
import type { Page } from '../model/schema';
import { getFeed } from './get-feed';

export type GetFeedResult = { ok: true; page: Page<PostView> } | { ok: false; error: ErrorBody };

/** The Server Action the feed calls for the next page; it returns the error body instead of throwing. */
export async function getFeedAction(input: unknown): Promise<GetFeedResult> {
  try {
    return { ok: true, page: await getFeed(input, { headers: await headers() }) };
  } catch (error) {
    if (!(error instanceof AppError)) {
      console.error('getFeed failed', error instanceof Error ? error.name : 'unknown');
    }
    return { ok: false, error: toErrorResponse(error).body };
  }
}
