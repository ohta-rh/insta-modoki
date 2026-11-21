import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LogInForm, getSessionUser } from '@/features/auth';

export const metadata = { title: 'ログイン | Mado（仮称）' };

export default async function LogInPage() {
  if (await getSessionUser(await headers())) redirect('/');
  return (
    <div className="mx-auto w-full max-w-[400px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">ログイン</h1>
      <LogInForm />
      <p className="mt-4 text-[length:var(--font-size-sm)]">
        アカウントをお持ちでない方は{' '}
        <Link href="/accounts/signup" className="font-bold text-indigo underline">
          サインアップ
        </Link>
      </p>
    </div>
  );
}
