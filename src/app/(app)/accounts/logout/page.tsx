import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LogOutConfirm, requireUser } from '@/features/auth';

export const metadata = { title: 'ログアウト | Mado（仮称）' };

export default async function LogOutPage() {
  try {
    await requireUser(await headers());
  } catch {
    redirect('/accounts/login');
  }
  return (
    <div className="mx-auto w-full max-w-[400px] p-4">
      <h1 className="mb-4 text-[length:var(--font-size-xl)] font-bold">ログアウトしますか？</h1>
      <LogOutConfirm />
    </div>
  );
}
