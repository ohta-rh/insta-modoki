import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { SignUpForm, getSessionUser } from '@/features/auth';

export const metadata = { title: 'サインアップ | Mado（仮称）' };

export default async function SignUpPage() {
  if (await getSessionUser(await headers())) redirect('/');
  return (
    <div className="mx-auto w-full max-w-[400px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">アカウントを作成</h1>
      <SignUpForm />
    </div>
  );
}
