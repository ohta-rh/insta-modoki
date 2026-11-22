import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { AppError } from '../../../shared/errors';
import { listInvites } from '../api/list-invites';
import { InviteAdmin } from './InviteAdmin';

/**
 * The administrator's screen. A signed-in user who is not an administrator gets the 404 page, so
 * the screen's existence is not shown; a visitor goes to log in (the (app) layout does so first).
 */
export async function InvitesPage() {
  let page;
  try {
    page = await listInvites({}, { headers: await headers() });
  } catch (error) {
    if (error instanceof AppError && error.code === 'UNAUTHENTICATED') redirect('/accounts/login');
    if (error instanceof AppError && error.code === 'FORBIDDEN') notFound();
    throw error;
  }
  return (
    <div className="mx-auto w-full max-w-[640px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">招待コードの管理</h1>
      <InviteAdmin initialItems={page.items} initialCursor={page.nextCursor} />
    </div>
  );
}
