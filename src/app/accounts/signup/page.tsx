import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, isInviteRequired, type AuthEnv } from '@/features/auth';
import { SignUpForm } from '@/features/auth/ui';
import { getRequestEnv } from '@/shared/db/request';

export const metadata = { title: 'サインアップ | Mado（仮称）' };

export default async function SignUpPage() {
  const requestHeaders = await headers();
  if (await getSessionUser(requestHeaders)) redirect('/');
  // Server-side: the setting never reaches the browser except as this one boolean.
  const inviteRequired = isInviteRequired(await getRequestEnv<AuthEnv>(), requestHeaders);
  return (
    <div className="mx-auto w-full max-w-[400px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">アカウントを作成</h1>
      <SignUpForm inviteRequired={inviteRequired} />
    </div>
  );
}
