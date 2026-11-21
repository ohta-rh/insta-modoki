import { createHash } from 'node:crypto';
import type { StorageClient } from './client';

/** S3 DeleteObjects takes up to 1,000 keys per request. */
const BATCH = 1000;

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const unescapeXml = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

/** The keys the response reports as failed. A key that is already gone is not a failure. */
function failedKeys(xml: string): string[] {
  const failed: string[] = [];
  for (const m of xml.matchAll(/<Error>([\s\S]*?)<\/Error>/g)) {
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1]!)?.[1];
    const code = /<Code>([\s\S]*?)<\/Code>/.exec(m[1]!)?.[1];
    if (key !== undefined && code !== 'NoSuchKey') failed.push(unescapeXml(key));
  }
  return failed;
}

/**
 * Deletes objects with S3 multi-object delete: one request per 1,000 keys, so a post with ten
 * photos costs one subrequest, not forty (the Workers free plan allows 50). Never throws:
 * returns the keys that could not be deleted. Keys the response marks as errors are returned
 * alone; when a whole request fails, all of its keys are returned. A key already gone is fine.
 */
export async function removeObjects(client: StorageClient, keys: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (let i = 0; i < keys.length; i += BATCH) {
    const chunk = keys.slice(i, i + BATCH);
    const body =
      '<?xml version="1.0" encoding="UTF-8"?><Delete><Quiet>true</Quiet>' +
      chunk.map((k) => `<Object><Key>${escapeXml(k)}</Key></Object>`).join('') +
      '</Delete>';
    try {
      const res = await client.aws.fetch(`${client.bucketUrl}?delete`, {
        method: 'POST',
        body,
        headers: {
          'content-type': 'application/xml',
          'content-md5': createHash('md5').update(body).digest('base64'),
        },
      });
      if (!res.ok) failed.push(...chunk);
      else failed.push(...failedKeys(await res.text()));
    } catch {
      failed.push(...chunk);
    }
  }
  return failed;
}
