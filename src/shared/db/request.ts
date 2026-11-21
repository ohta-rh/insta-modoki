import { getDb, type Db, type DbEnv } from './client';

/** The Workers bindings of the current request. Imported lazily so unit tests never load OpenNext. */
export async function getRequestEnv<T extends DbEnv = DbEnv>(): Promise<T> {
  const { getCloudflareContext } = await import('@opennextjs/cloudflare');
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as T;
}

export async function getRequestDb(): Promise<Db> {
  return getDb(await getRequestEnv());
}
