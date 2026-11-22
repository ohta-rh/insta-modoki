import type { StorageClient } from './client';

const unescapeXml = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&');

/**
 * One page of S3 ListObjectsV2: the keys under `prefix` after `startAfter`, in key order, at most
 * `maxKeys` (1 to 1,000). `lastModified` is epoch milliseconds. Throws on a non-2xx response with
 * the status only (the key, the bucket URL and the body stay out of the message).
 */
export async function listObjects(
  client: StorageClient,
  input: { prefix: string; startAfter?: string; maxKeys: number },
): Promise<{ objects: { key: string; lastModified: number }[]; isTruncated: boolean }> {
  const { prefix, startAfter, maxKeys } = input;
  if (!Number.isInteger(maxKeys) || maxKeys < 1 || maxKeys > 1000) {
    throw new RangeError('maxKeys は 1〜1000 です');
  }
  let url = `${client.bucketUrl}?list-type=2&prefix=${encodeURIComponent(prefix)}&max-keys=${maxKeys}`;
  if (startAfter) url += `&start-after=${encodeURIComponent(startAfter)}`;
  const res = await client.aws.fetch(url);
  if (!res.ok) throw new Error('オブジェクトを一覧できませんでした: ' + res.status);
  const xml = await res.text();
  const objects: { key: string; lastModified: number }[] = [];
  for (const m of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
    const key = /<Key>([\s\S]*?)<\/Key>/.exec(m[1]!)?.[1];
    const modified = /<LastModified>([\s\S]*?)<\/LastModified>/.exec(m[1]!)?.[1];
    if (key === undefined || modified === undefined) continue;
    objects.push({ key: unescapeXml(key), lastModified: Date.parse(modified) });
  }
  return { objects, isTruncated: /<IsTruncated>true<\/IsTruncated>/.test(xml) };
}
