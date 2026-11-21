import { objectUrl, type StorageClient } from './client';

const CONCURRENCY = 8;

/** Deletes objects by key. A key that is already gone is not an error; any other failure throws. */
export async function removeObjects(client: StorageClient, keys: string[]): Promise<void> {
  for (let i = 0; i < keys.length; i += CONCURRENCY) {
    await Promise.all(
      keys.slice(i, i + CONCURRENCY).map(async (key) => {
        const res = await client.aws.fetch(objectUrl(client, key), { method: 'DELETE' });
        if (!res.ok && res.status !== 404) {
          throw new Error(`オブジェクトを削除できませんでした: ${res.status}`);
        }
      }),
    );
  }
}
