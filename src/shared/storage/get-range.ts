import { objectUrl, type StorageClient } from './client';

/**
 * Reads `length` bytes of one object from `offset` (an HTTP range request). The end of the object
 * cuts the answer short. A 200 (the server ignored the range) is cut to the range here; any other
 * status, including 404 and 416, throws.
 */
export async function getRange(
  client: StorageClient,
  key: string,
  offset: number,
  length: number,
): Promise<Uint8Array> {
  const res = await client.aws.fetch(objectUrl(client, key), {
    headers: { range: `bytes=${offset}-${offset + length - 1}` },
  });
  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`オブジェクトを読めませんでした: ${res.status}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return res.status === 206 ? bytes : bytes.slice(offset, offset + length);
}
