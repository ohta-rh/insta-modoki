'use server';

import { headers } from 'next/headers';
import { failure } from '../../../shared/action';
import type { ErrorBody } from '../../../shared/errors';
import { requestUploadUrls, type UploadSlot } from './request-upload-urls';

export type RequestUploadUrlsResult =
  { ok: true; uploads: UploadSlot[] } | { ok: false; error: ErrorBody };

/** The Server Action the browser calls; it never throws to the client, it returns the error body. */
export async function requestUploadUrlsAction(input: unknown): Promise<RequestUploadUrlsResult> {
  try {
    return { ok: true, ...(await requestUploadUrls(input, { headers: await headers() })) };
  } catch (error) {
    return failure('requestUploadUrls', error);
  }
}
