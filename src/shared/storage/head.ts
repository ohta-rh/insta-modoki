import { objectUrl, type StorageClient } from './client';

export type ObjectInfo = { size: number; contentType: string };

/** HEAD one object: its size and content type, or null when it is absent. Any other failure throws. */
export async function headObject(client: StorageClient, key: string): Promise<ObjectInfo | null> {
  const res = await client.aws.fetch(objectUrl(client, key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`オブジェクトを確認できませんでした: ${res.status}`);
  return {
    size: Number(res.headers.get('content-length')),
    contentType: res.headers.get('content-type') ?? '',
  };
}
