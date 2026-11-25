import Link from 'next/link';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSessionUser, isInviteRequired, type AuthEnv } from '@/features/auth';
import { SignUpForm } from '@/features/auth/ui';
import { getRequestEnv } from '@/shared/db/request';
import { ChevronLeftIcon } from '@/shared/ui/icons';

export const metadata = { title: 'サインアップ | Mado（仮称）' };

export default async function SignUpPage() {
  const requestHeaders = await headers();
  if (await getSessionUser(requestHeaders)) redirect('/');
  // Server-side: the setting never reaches the browser except as this one boolean.
  const inviteRequired = isInviteRequired(await getRequestEnv<AuthEnv>(), requestHeaders);
  return (
    <div className="mx-auto w-full max-w-[592px] px-4 py-6">
      <Link
        href="/accounts/login"
        aria-label="ログイン画面に戻る"
        className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-surface"
      >
        <ChevronLeftIcon />
      </Link>
      <h1 className="mt-4 text-[length:var(--font-size-xl)] leading-[28px] font-semibold">
        アカウントを作成
      </h1>
      <p className="mt-2 mb-5 text-[15px]">写真で毎日を共有しましょう。</p>
      <SignUpForm inviteRequired={inviteRequired} />
      <Link
        href="/accounts/login"
        className="mt-3 flex h-11 items-center justify-center rounded-pill bg-highlight text-[15px] font-medium"
      >
        アカウントをお持ちの場合
      </Link>
    </div>
  );
}
