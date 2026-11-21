'use client';

import { useActionState } from 'react';
import { logInAction, type LogInState } from '../api/actions';

const INPUT =
  'min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-red-600';
const ERROR = 'mt-1 text-[length:var(--font-size-sm)] text-red-700';

type FieldProps = {
  name: 'email' | 'password';
  label: string;
  type: string;
  autoComplete: string;
  defaultValue?: string;
  errors?: string[];
};

function Field({ name, label, errors, ...rest }: FieldProps) {
  const errorId = `${name}-error`;
  const invalid = errors !== undefined && errors.length > 0;
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-[length:var(--font-size-sm)] font-bold">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={INPUT}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? errorId : undefined}
        {...rest}
      />
      {invalid ? (
        <p id={errorId} className={ERROR}>
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

export function LogInForm() {
  const [state, action, pending] = useActionState<LogInState, FormData>(logInAction, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <p role="alert" className={ERROR}>
          {state.message}
        </p>
      ) : null}
      <Field
        name="email"
        label="メールアドレス"
        type="email"
        autoComplete="email"
        defaultValue={state.values?.email}
        errors={fe.email}
      />
      <Field
        name="password"
        label="パスワード"
        type="password"
        autoComplete="current-password"
        errors={fe.password}
      />
      <button
        type="submit"
        disabled={pending}
        className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-4 font-bold text-white disabled:opacity-50"
      >
        ログイン
      </button>
    </form>
  );
}
