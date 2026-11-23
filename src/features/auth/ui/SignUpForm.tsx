'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { checkUsernameAction, signUpAction, type SignUpState } from '../api/actions';
import { FloatingField } from './FloatingField';

const ERROR = 'mt-1 text-[length:var(--font-size-sm)] text-danger';

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

function Field({ errors, onBlur, announce, ...rest }: FieldProps) {
  const invalid = errors !== undefined && errors.length > 0;
  const input = useRef<HTMLInputElement>(null);
  // `errors` is a new array for each result of the action, so a repeated error focuses again.
  useEffect(() => {
    if (announce && invalid) input.current?.focus();
  }, [announce, invalid, errors]);
  return (
    <FloatingField
      ref={input}
      error={invalid ? errors.join(' ') : undefined}
      announce={announce}
      onBlur={onBlur ? (e) => onBlur(e.currentTarget.value) : undefined}
      {...rest}
    />
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
    <form action={action} className="flex w-full flex-col gap-3" noValidate>
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
        className="mt-3 h-11 w-full rounded-pill bg-indigo text-[15px] font-medium text-white disabled:opacity-40"
      >
        サインアップ
      </button>
    </form>
  );
}
