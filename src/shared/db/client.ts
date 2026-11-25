import { drizzle, type AnyD1Database } from 'drizzle-orm/d1';
import * as schema from './schema';

/** The Workers bindings this module needs. */
export type DbEnv = { DB: AnyD1Database };

export function getDb(env: DbEnv) {
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
