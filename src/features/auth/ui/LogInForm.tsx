'use client';

import { useActionState } from 'react';
import { logInAction, type LogInState } from '../api/actions';
import { FloatingField } from './FloatingField';

const ERROR = 'mt-1 text-[length:var(--font-size-sm)] text-danger';

export function LogInForm() {
  const [state, action, pending] = useActionState<LogInState, FormData>(logInAction, {});
  const fe = state.fieldErrors ?? {};
  // A sentence about the whole form (a wrong password) also turns both borders red.
  const formFailed = Boolean(state.message);
  return (
    <form action={action} className="flex w-full flex-col gap-3" noValidate>
      {state.message ? (
        <p id="login-error" role="alert" className={ERROR}>
          {state.message}
        </p>
      ) : null}
      <FloatingField
        name="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        error={fe.email?.join(' ')}
        invalid={formFailed}
        describedBy={formFailed ? 'login-error' : undefined}
      />
      <FloatingField
        name="password"
        label="パスワード"
        type="password"
        autoComplete="current-password"
        error={fe.password?.join(' ')}
        invalid={formFailed}
        describedBy={formFailed ? 'login-error' : undefined}
      />
      <button
        type="submit"
        disabled={pending}
        className="mt-3 h-11 w-full rounded-pill bg-indigo text-[15px] font-medium text-white disabled:opacity-40"
      >
        ログイン
      </button>
    </form>
  );
}
