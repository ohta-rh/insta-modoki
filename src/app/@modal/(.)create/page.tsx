import { headers } from 'next/headers';
import { getSessionUser } from '@/features/auth';
import { CreatePostModal } from '@/features/post-create/ui';

// `(.)create` intercepts /create when the nav's 投稿 is pressed (a soft navigation) and shows the
// modal over the screen that was open (ADR-0043). It sits in the root layout's own slot, not in
// `(app)` or `[username]`: under [username] the router treats `create` as a username and drops the
// profile behind the modal. A direct load or a reload skips this file and gets the page. The nav's
// 投稿 goes to the login screen without a session, so a visitor never reaches this file.
export default async function CreateModalPage() {
  const user = await getSessionUser(await headers());
  if (!user) return null;
  return <CreatePostModal viewer={{ username: user.username }} />;
}
