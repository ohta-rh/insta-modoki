import type { AuthEnv } from '../../auth/api/auth-env';
import type { removeObjects } from '../../../shared/storage';
import type { StorageEnv } from '../../../shared/storage';

export type AdminDeps = {
  env?: AuthEnv & StorageEnv;
  headers: Headers;
  /** Replaced by tests to make the storage fail. */
  removeObjects?: typeof removeObjects;
  now?: number;
};

/** What the list processes need: no storage. */
export type AdminListDeps = { env?: AuthEnv; headers: Headers };
