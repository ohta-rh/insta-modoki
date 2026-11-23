import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AppError } from '../../../shared/errors';
import { listAdminPosts } from '../api/list-admin-posts';
import { listAdminUsers } from '../api/list-admin-users';
import { AdminTabs } from './AdminTabs';

/**
 * The administrator's screen. A signed-in user who is not an administrator gets the 404 page, so
 * the screen's existence is not shown; a visitor goes to log in.
 */
export async function AdminDashboard() {
  const requestHeaders = await headers();
  let posts;
  let users;
  try {
    [posts, users] = await Promise.all([
      listAdminPosts({}, { headers: requestHeaders }),
      listAdminUsers({}, { headers: requestHeaders }),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    if (error instanceof AppError && error.code === 'FORBIDDEN') notFound();
    throw error;
  }
  return (
    <div className="mx-auto w-full max-w-[960px] p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-[length:var(--font-size-xl)] font-bold">管理</h1>
        <a
          href="/admin/invites"
          className="inline-flex min-h-[var(--tap-min)] items-center font-bold underline"
        >
          招待コードの管理
        </a>
      </div>
      <AdminTabs posts={posts} users={users} />
    </div>
  );
}
