'use server';

import { run, type ActionResult } from '../../../shared/action';
import type { UserSummary } from '../../post';
import { searchUsers } from './search-users';

/**
 * The Server Action the search box calls once the page is hydrated. It never throws to the
 * client; it returns the error body (a transport failure is the box's own message).
 */
export async function searchUsersAction(
  q: unknown,
): Promise<ActionResult<{ items: UserSummary[] }>> {
  return run('searchUsers', (h) => searchUsers({ q }, { headers: h }));
}
