'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useActionState, useState } from 'react';
import { UploadError, uploadImages } from '../../media-upload';
import { charLength } from '../../../shared/text';
import { updateProfileAction, updateProfileFormAction } from '../api/actions';
import { BIO_MESSAGE, DISPLAY_NAME_MESSAGE, MAX_BIO, MAX_DISPLAY_NAME } from '../model/limits';
import type { ProfileView } from '../model/schema';
import { AvatarField, type PickedAvatar } from './AvatarField';

const UPLOAD_FAILED = 'アップロードに失敗しました。もう一度お試しください';
const INPUT =
  'min-h-[var(--tap-min)] w-full rounded-lg border border-border bg-bg px-3 py-2 text-[length:var(--font-size-md)] text-text aria-[invalid=true]:border-red-600';
const COUNT = 'mt-1 text-right text-[length:var(--font-size-sm)]';
const ERROR = 'text-[length:var(--font-size-sm)] text-red-700';

/**
 * /accounts/edit: display name, bio and icon. Saving stores a new icon (the same photo is not
 * stored again on a retry), calls `updateProfile` and goes to the profile. A failure keeps every
 * input and the picked photo, shows the message as an alert, and the button works again.
 */
export function EditProfileForm({ profile }: { profile: ProfileView }) {
  const router = useRouter();
  // The form posts to a Server Action by itself (before hydration too); `refused` is its answer.
  const [refused, formAction] = useActionState(updateProfileFormAction, null);
  const [displayName, setDisplayName] = useState(
    refused?.values.displayName ?? profile.displayName,
  );
  const [bio, setBio] = useState(refused?.values.bio ?? profile.bio);
  const [picked, setPicked] = useState<PickedAvatar | null>(null);
  const [stored, setStored] = useState<{ file: File; key: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const nameLength = charLength(displayName.trim());
  const nameBad = nameLength < 1 || nameLength > MAX_DISPLAY_NAME;
  const bioLength = charLength(bio);
  const bioBad = bioLength > MAX_BIO;
  // The server's message for a field, while the field still holds what was refused.
  const refusedMessage = (field: 'displayName' | 'bio', value: string) =>
    refused?.values[field] === value ? refused.fieldErrors[field]?.[0] : undefined;
  const nameMessage = nameBad ? DISPLAY_NAME_MESSAGE : refusedMessage('displayName', displayName);
  const bioMessage = bioBad ? BIO_MESSAGE : refusedMessage('bio', bio);
  // A refusal that names no field (a bad icon, ...) is shown once, under the fields.
  const refusedOther =
    refused && Object.keys(refused.fieldErrors).length === 0 ? refused.message : null;

  async function submit() {
    setBusy(true);
    setFailure(null);
    try {
      let avatarKey: string | undefined;
      if (picked) {
        if (stored?.file === picked.file) {
          avatarKey = stored.key;
        } else {
          const [image] = await uploadImages([picked.file], { crops: [picked.crop] });
          avatarKey = image!.key;
          setStored({ file: picked.file, key: avatarKey });
        }
      }
      const result = await updateProfileAction({ displayName, bio, avatarKey });
      if (!result.ok) {
        setFailure(result.error.message);
        setBusy(false);
        return;
      }
      // Stay locked while the profile loads.
      router.push(`/${profile.username}`);
    } catch (error) {
      setFailure(error instanceof UploadError ? error.message : UPLOAD_FAILED);
      setBusy(false);
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-[640px] flex-col gap-5 p-4"
      action={formAction}
      // Only exists once hydrated: then the icon is stored first and the plain post is skipped.
      onSubmit={(e) => {
        e.preventDefault();
        if (!nameBad && !bioBad && !busy) void submit();
      }}
    >
      <h1 className="text-[length:var(--font-size-xl)] font-bold">プロフィールを編集</h1>
      <fieldset disabled={busy} className="flex flex-col gap-5">
        <AvatarField
          avatarUrl={profile.avatarUrl}
          initial={Array.from(profile.username)[0]?.toUpperCase() ?? ''}
          disabled={busy}
          onPick={setPicked}
        />
        <div>
          <label
            htmlFor="displayName"
            className="mb-1 block text-[length:var(--font-size-sm)] font-bold"
          >
            表示名
          </label>
          <input
            id="displayName"
            name="displayName"
            type="text"
            value={displayName}
            aria-invalid={nameMessage ? 'true' : undefined}
            aria-describedby="displayName-count"
            className={INPUT}
            onChange={(e) => setDisplayName(e.currentTarget.value)}
          />
          <p
            id="displayName-count"
            className={`${COUNT} ${nameBad ? 'font-bold text-red-700' : 'text-text-muted'}`}
          >
            {nameLength} / {MAX_DISPLAY_NAME}
          </p>
          {nameMessage && (
            <p role="alert" className={ERROR}>
              {nameMessage}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="bio" className="mb-1 block text-[length:var(--font-size-sm)] font-bold">
            自己紹介
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={4}
            value={bio}
            aria-invalid={bioMessage ? 'true' : undefined}
            aria-describedby="bio-count"
            className={INPUT}
            onChange={(e) => setBio(e.currentTarget.value)}
          />
          <p
            id="bio-count"
            className={`${COUNT} ${bioBad ? 'font-bold text-red-700' : 'text-text-muted'}`}
          >
            {bioLength} / {MAX_BIO}
          </p>
          {bioMessage && (
            <p role="alert" className={ERROR}>
              {bioMessage}
            </p>
          )}
        </div>
      </fieldset>

      {/* Set by the script path once the icon is stored; the plain post never sends a file. */}
      <input type="hidden" name="avatarKey" value={stored?.key ?? ''} />
      {(failure ?? refusedOther) !== null && (
        <p role="alert" className={ERROR}>
          {failure ?? refusedOther}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={nameBad || bioBad || busy}
          className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-6 font-bold text-white disabled:opacity-50"
        >
          保存
        </button>
        {busy && (
          <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
            保存しています…
          </p>
        )}
      </div>
      <Link
        href="/accounts/logout"
        className="inline-flex min-h-[var(--tap-min)] items-center self-start font-bold text-text-secondary underline"
      >
        ログアウト
      </Link>
    </form>
  );
}
