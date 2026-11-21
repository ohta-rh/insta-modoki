import { getStorageClient, objectUrl, type StorageEnv } from '../../storage/client.ts';

export type Store = {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
};

const CONCURRENCY = 8;

/** Writes and deletes objects in the slot's bucket (`S3_BUCKET`) only. */
export function createStore(env: StorageEnv): Store {
  const client = getStorageClient(env);
  const send = client.aws.fetch.bind(client.aws);
  return {
    async put(key, body, contentType) {
      const res = await send(objectUrl(client, key), {
        method: 'PUT',
        body: body as BodyInit,
        headers: { 'content-type': contentType },
      });
      if (!res.ok) throw new Error(`オブジェクトを書けませんでした: ${key} ${res.status}`);
    },
    async remove(keys) {
      for (let i = 0; i < keys.length; i += CONCURRENCY) {
        await Promise.all(
          keys.slice(i, i + CONCURRENCY).map(async (key) => {
            const res = await send(objectUrl(client, key), { method: 'DELETE' });
            if (!res.ok && res.status !== 404) {
              throw new Error(`オブジェクトを削除できませんでした: ${key} ${res.status}`);
            }
          }),
        );
      }
    },
  };
}
