import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { isUnauthenticated, requireUser } from '@/features/auth';
import { EditProfileForm, getProfile } from '@/features/profile';

export const metadata = { title: 'プロフィールを編集 | Mado（仮称）' };

// Under (app) the layout already sends visitors to the login screen, but the read and the save
// each check the session themselves (ADR-0031). Built per viewer, never cached.
export default async function EditProfilePage() {
  const requestHeaders = await headers();
  let profile;
  try {
    const user = await requireUser(requestHeaders);
    profile = await getProfile({ username: user.username }, { headers: requestHeaders });
  } catch (error) {
    if (!isUnauthenticated(error)) throw error;
    redirect('/accounts/login');
  }
  return <EditProfileForm profile={profile} />;
}
