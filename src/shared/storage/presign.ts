import { objectUrl, type StorageClient } from './client';

export type PresignPutInput = {
  key: string;
  contentType: string;
  contentLength: number;
  expiresInSec: number;
  /** Epoch milliseconds of issue; tests pass an earlier time to age a URL. */
  now?: number;
};

/** `YYYYMMDDTHHMMSSZ`, the form aws4fetch signs with. */
const amzDate = (ms: number): string =>
  new Date(ms)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/**
 * A presigned PUT URL (ADR-0021). `content-type` and `content-length` are part of the signature
 * (`allHeaders`), so a PUT with another type or size is refused (403).
 */
export async function presignPut(client: StorageClient, input: PresignPutInput): Promise<string> {
  const url = new URL(objectUrl(client, input.key));
  url.searchParams.set('X-Amz-Expires', String(input.expiresInSec));
  const signed = await client.aws.sign(url.toString(), {
    method: 'PUT',
    headers: {
      'content-type': input.contentType,
      'content-length': String(input.contentLength),
    },
    aws: {
      signQuery: true,
      allHeaders: true,
      datetime: amzDate(input.now ?? Date.now()),
    },
  });
  return signed.url;
}
