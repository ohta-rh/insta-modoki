'use client';

import { useId, useRef, useState } from 'react';
import { INTERNAL_MESSAGE, type ErrorBody } from '../../../shared/errors';
import { trapTab } from '../../../shared/ui/focus-trap';
import { createInviteAction, listInvitesAction, revokeInviteAction } from '../api/actions';
import type { InviteStatus } from '../model/status';
import type { InviteView } from '../model/view';

const STATUS_LABEL: Record<InviteStatus, string> = {
  active: '有効',
  expired: '期限切れ',
  revoked: '無効',
  used_up: '使い切り',
};

const INPUT =
  'min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-red-600';
const BUTTON =
  'min-h-[var(--tap-min)] min-w-[var(--tap-min)] rounded-lg px-4 text-[length:var(--font-size-sm)] font-bold';
const ERROR = 'mt-1 text-[length:var(--font-size-sm)] text-danger';

const formatDate = (d: Date) =>
  new Date(d).toLocaleString('ja-JP', { dateStyle: 'medium', timeStyle: 'short' });

type Props = { initialItems: InviteView[]; initialCursor: string | null };

/** The administrator's invite screen: issue, list (20 at a time), copy a code, revoke after a confirmation. */
export function InviteAdmin({ initialItems, initialCursor }: Props) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [error, setError] = useState<ErrorBody | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState('');
  const [target, setTarget] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const inFlight = useRef(false);

  const fail = (e: ErrorBody) => {
    setError(e);
    setFieldErrors(e.fieldErrors ?? {});
  };

  const issue = async (data: FormData) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    setFieldErrors({});
    setNotice('');
    try {
      const num = (name: string) => {
        const v = data.get(name);
        return typeof v === 'string' && v.trim() !== '' ? Number(v) : undefined;
      };
      const result = await createInviteAction({
        maxUses: num('maxUses'),
        expiresInDays: num('expiresInDays'),
      });
      if (result.ok) setItems((cur) => [result.data, ...cur]);
      else fail(result.error);
    } catch {
      fail({ code: 'INTERNAL', message: INTERNAL_MESSAGE });
    }
    inFlight.current = false;
    setPending(false);
  };

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setNotice(`コード ${code} をコピーしました`);
    } catch {
      setNotice('コピーできませんでした。コードを選んでコピーしてください');
    }
  };

  const askRevoke = (code: string, button: HTMLElement) => {
    opener.current = button;
    setTarget(code);
    setError(null);
    dialog.current?.showModal();
  };

  const revoke = async () => {
    if (inFlight.current || target === null) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await revokeInviteAction({ code: target });
      if (result.ok) {
        setItems((cur) =>
          cur.map((i) =>
            i.code === target ? { ...i, revokedAt: new Date(), status: 'revoked' as const } : i,
          ),
        );
        dialog.current?.close();
      } else {
        fail(result.error);
        dialog.current?.close();
      }
    } catch {
      fail({ code: 'INTERNAL', message: INTERNAL_MESSAGE });
      dialog.current?.close();
    }
    inFlight.current = false;
    setPending(false);
  };

  const more = async () => {
    if (inFlight.current || cursor === null) return;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await listInvitesAction({ cursor });
      if (result.ok) {
        setItems((cur) => [...cur, ...result.data.items]);
        setCursor(result.data.nextCursor);
      } else fail(result.error);
    } catch {
      fail({ code: 'INTERNAL', message: INTERNAL_MESSAGE });
    }
    inFlight.current = false;
    setPending(false);
  };

  const maxUsesError = fieldErrors.maxUses?.join(' ');
  const daysError = fieldErrors.expiresInDays?.join(' ');
  const formError = error && !maxUsesError && !daysError ? error.message : null;

  return (
    <div className="flex flex-col gap-6">
      <form action={issue} className="flex flex-col gap-4" noValidate>
        <div>
          <label
            htmlFor="maxUses"
            className="mb-1 block text-[length:var(--font-size-sm)] font-bold"
          >
            使用回数
          </label>
          <input
            id="maxUses"
            name="maxUses"
            type="number"
            inputMode="numeric"
            min={1}
            max={100}
            defaultValue={5}
            className={INPUT}
            aria-invalid={maxUsesError ? 'true' : undefined}
            aria-describedby={maxUsesError ? 'maxUses-error' : undefined}
          />
          {maxUsesError ? (
            <p id="maxUses-error" role="alert" className={ERROR}>
              {maxUsesError}
            </p>
          ) : null}
        </div>
        <div>
          <label
            htmlFor="expiresInDays"
            className="mb-1 block text-[length:var(--font-size-sm)] font-bold"
          >
            有効日数
          </label>
          <input
            id="expiresInDays"
            name="expiresInDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            defaultValue={7}
            className={INPUT}
            aria-invalid={daysError ? 'true' : undefined}
            aria-describedby={daysError ? 'expiresInDays-error' : undefined}
          />
          {daysError ? (
            <p id="expiresInDays-error" role="alert" className={ERROR}>
              {daysError}
            </p>
          ) : null}
        </div>
        {formError ? (
          <p role="alert" className={ERROR}>
            {formError}
          </p>
        ) : null}
        <button
          type="submit"
          aria-disabled={pending || undefined}
          onClick={(e) => {
            if (pending) e.preventDefault();
          }}
          className={`${BUTTON} bg-indigo text-white aria-disabled:opacity-50`}
        >
          発行
        </button>
      </form>

      <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
        {notice}
      </p>

      <section aria-labelledby="invites-heading">
        <h2 id="invites-heading" className="mb-2 text-[length:var(--font-size-md)] font-bold">
          発行した招待コード
        </h2>
        {items.length === 0 ? (
          <p className="text-[length:var(--font-size-sm)] text-text-secondary">
            まだ招待コードはありません
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((invite) => (
              <li
                key={invite.code}
                className="flex flex-col gap-2 rounded-lg border border-border p-3"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <code className="font-mono text-[length:var(--font-size-md)] font-bold">
                    {invite.code}
                  </code>
                  <span className="rounded bg-surface px-2 text-[length:var(--font-size-sm)] font-bold">
                    {STATUS_LABEL[invite.status]}
                  </span>
                </div>
                <p className="text-[length:var(--font-size-sm)] text-text-secondary">
                  使用 {invite.usedCount} / {invite.maxUses} 回 ・ 期限{' '}
                  {formatDate(invite.expiresAt)}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copy(invite.code)}
                    aria-label={`コードをコピー（${invite.code}）`}
                    className={`${BUTTON} border border-border hover:bg-surface`}
                  >
                    コードをコピー
                  </button>
                  {invite.status !== 'revoked' ? (
                    <button
                      type="button"
                      onClick={(e) => askRevoke(invite.code, e.currentTarget)}
                      aria-label={`招待コード ${invite.code} を失効`}
                      className={`${BUTTON} text-danger hover:bg-wash`}
                    >
                      失効
                    </button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {cursor !== null ? (
          <button
            type="button"
            onClick={more}
            aria-disabled={pending || undefined}
            className={`${BUTTON} mt-3 border border-border hover:bg-surface aria-disabled:opacity-50`}
          >
            さらに表示
          </button>
        ) : null}
      </section>

      <dialog
        ref={dialog}
        role="alertdialog"
        aria-labelledby={titleId}
        onCancel={(e) => pending && e.preventDefault()}
        onClose={() => {
          setTarget(null);
          opener.current?.focus();
        }}
        onKeyDown={(e) => trapTab(e, e.currentTarget)}
        className="m-auto w-[min(92vw,360px)] rounded-xl bg-bg p-5 text-text shadow-xl backdrop:bg-black/50"
      >
        <h2 id={titleId} className="text-[length:var(--font-size-md)] font-bold">
          この招待コードを失効しますか？
        </h2>
        <p className="mt-2 text-[length:var(--font-size-sm)] text-text-secondary">
          失効したコードでは登録できなくなります。元に戻せません。
        </p>
        <form method="dialog" className="mt-5 flex justify-end gap-2">
          <button
            type="submit"
            aria-disabled={pending || undefined}
            onClick={(e) => {
              if (pending) e.preventDefault();
            }}
            className={`${BUTTON} border border-border hover:bg-surface aria-disabled:opacity-50`}
          >
            キャンセル
          </button>
          <button
            type="button"
            onClick={revoke}
            aria-disabled={pending || undefined}
            className={`${BUTTON} bg-text text-bg aria-disabled:opacity-50`}
          >
            失効する
          </button>
        </form>
      </dialog>
    </div>
  );
}
