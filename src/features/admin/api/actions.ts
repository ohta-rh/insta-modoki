'use server';

import { run, type ActionResult } from '../../../shared/action';
import type { AdminPage, AdminPostRow, AdminUserRow } from '../model/schema';
import { adminDeletePost } from './admin-delete-post';
import { adminDeleteUser } from './admin-delete-user';
import { listAdminPosts } from './list-admin-posts';
import { listAdminUsers } from './list-admin-users';

/** The admin screen's Server Actions: each returns the result or the error body, never throws. */
export async function adminDeletePostAction(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  return run('adminDeletePost', (headers) => adminDeletePost(input, { headers }));
}

export async function adminDeleteUserAction(
  input: unknown,
): Promise<ActionResult<{ deleted: true }>> {
  return run('adminDeleteUser', (headers) => adminDeleteUser(input, { headers }));
}

export async function listAdminPostsAction(
  input: unknown,
): Promise<ActionResult<AdminPage<AdminPostRow>>> {
  return run('listAdminPosts', (headers) => listAdminPosts(input, { headers }));
}

export async function listAdminUsersAction(
  input: unknown,
): Promise<ActionResult<AdminPage<AdminUserRow>>> {
  return run('listAdminUsers', (headers) => listAdminUsers(input, { headers }));
}
