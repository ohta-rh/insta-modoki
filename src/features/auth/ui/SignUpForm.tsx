'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { checkUsernameAction, signUpAction, type SignUpState } from '../api/actions';

const INPUT =
  'min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-red-600';
const ERROR = 'mt-1 text-[length:var(--font-size-sm)] text-red-700';

type FieldProps = {
  name: 'email' | 'username' | 'displayName' | 'password' | 'inviteCode';
  label: string;
  type?: string;
  autoComplete: string;
  defaultValue?: string;
  errors?: string[];
  onBlur?: (value: string) => void;
  maxLength?: number;
  /** The error is announced (role="alert") and the field takes the focus when a new error arrives. */
  announce?: boolean;
};

function Field({ name, label, type = 'text', errors, onBlur, announce, ...rest }: FieldProps) {
  const errorId = `${name}-error`;
  const invalid = errors !== undefined && errors.length > 0;
  const input = useRef<HTMLInputElement>(null);
  // `errors` is a new array for each result of the action, so a repeated error focuses again.
  useEffect(() => {
    if (announce && invalid) input.current?.focus();
  }, [announce, invalid, errors]);
  return (
    <div>
      <label htmlFor={name} className="mb-1 block text-[length:var(--font-size-sm)] font-bold">
        {label}
      </label>
      <input
        ref={input}
        id={name}
        name={name}
        type={type}
        className={INPUT}
        aria-invalid={invalid ? 'true' : undefined}
        aria-describedby={invalid ? errorId : undefined}
        onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
        {...rest}
      />
      {invalid ? (
        <p id={errorId} role={announce ? 'alert' : undefined} className={ERROR}>
          {errors.join(' ')}
        </p>
      ) : null}
    </div>
  );
}

export function SignUpForm({ inviteRequired = false }: { inviteRequired?: boolean }) {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUpAction, {});
  // The result of the last on-blur check (not per keystroke); cleared by the next blur.
  const [checked, setChecked] = useState<{ name: string; message: string | null } | null>(null);

  const onUsernameBlur = async (value: string) => {
    const name = value.trim();
    if (name === '') return setChecked(null);
    const result = await checkUsernameAction(name);
    if ('error' in result) setChecked({ name, message: result.error });
    else setChecked({ name, message: result.available ? null : 'このユーザー名は使われています' });
  };

  const usernameErrors = [
    ...(checked?.message ? [checked.message] : []),
    ...(state.fieldErrors?.username ?? []).filter((m) => m !== checked?.message),
  ];
  const fe = state.fieldErrors ?? {};
  const taken = checked?.message === 'このユーザー名は使われています';

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.message ? (
        <p role="alert" className={ERROR}>
          {state.fieldErrors ? '入力を確認してください' : state.message}
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
        name="username"
        label="ユーザー名"
        autoComplete="username"
        defaultValue={state.values?.username}
        errors={usernameErrors}
        onBlur={onUsernameBlur}
      />
      <Field
        name="displayName"
        label="表示名"
        autoComplete="name"
        defaultValue={state.values?.displayName}
        errors={fe.displayName}
      />
      <Field
        name="password"
        label="パスワード"
        type="password"
        autoComplete="new-password"
        errors={fe.password}
      />
      {inviteRequired ? (
        <Field
          name="inviteCode"
          label="招待コード"
          autoComplete="off"
          defaultValue={state.values?.inviteCode}
          errors={fe.inviteCode}
          announce
        />
      ) : null}
      <button
        type="submit"
        disabled={pending || taken}
        className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-4 font-bold text-white disabled:opacity-50"
      >
        サインアップ
      </button>
    </form>
  );
}
