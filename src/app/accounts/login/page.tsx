import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/features/auth';
import { LogInForm } from '@/features/auth/ui';
import { Logo } from '@/shared/ui';

export const metadata = { title: 'ログイン | Mado（仮称）' };

export default async function LogInPage() {
  if (await getSessionUser(await headers())) redirect('/');
  return (
    // The shell's `main` is already the landmark; this page widens it (`data-page-width="wide"`).
    <div data-page-width="wide" className="min-h-screen lg:grid lg:grid-cols-2">
      <div
        data-auth="hero"
        aria-hidden="true"
        className="hidden flex-col items-center justify-center border-r-2 border-[#e0e2e4] px-12 lg:flex"
      >
        <Logo size={60} />
        <p className="mt-6 text-center text-[35.84px] leading-[64.8px] font-normal">
          身近な人の毎日を、写真で。
        </p>
        <img src="/brand/login-hero.svg" alt="" width="420" height="320" className="mt-6" />
      </div>
      <div data-auth="pane" className="flex flex-col justify-center px-[52px] py-10">
        <div className="w-full max-w-[536px]">
          <h1 className="mb-5 text-[17px] leading-[22px] font-semibold">ログイン</h1>
          <LogInForm />
          <Link
            href="/accounts/signup"
            className="mt-3 flex h-11 items-center justify-center rounded-pill border border-indigo text-[15px] font-medium text-indigo"
          >
            新しいアカウントを作成
          </Link>
        </div>
      </div>
    </div>
  );
}
