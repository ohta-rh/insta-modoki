'use client';

import { useEffect, useRef, useState } from 'react';
import { useFilesPickedBeforeHydration } from '../../../shared/ui/files-picked-before-hydration';
import { validateFile, type Crop } from '../../media-upload';
import { centerSquare } from './crop';

export type PickedAvatar = { file: File; crop: Crop };

const NOT_READABLE = 'この形式の写真は、このブラウザでは読み込めません';
const SIZE = 'h-24 w-24 shrink-0 rounded-full bg-surface object-cover';

/** The photo's pixels after the EXIF turn, the way `processImage` will see them. */
async function readSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * The icon: the current picture (or the first letter), a native file input behind the
 * 「アイコンを変更」 label, and a round preview of the centered square that will be stored. A photo
 * that fails the checks keeps the earlier choice and says why; nothing is sent from here.
 */
export function AvatarField({
  avatarUrl,
  initial,
  disabled,
  onPick,
}: {
  avatarUrl: string | null;
  initial: string;
  disabled: boolean;
  onPick: (picked: PickedAvatar) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  useFilesPickedBeforeHydration(input, (files) => void pick(files[0]));
  const [preview, setPreview] = useState<{ url: string; crop: Crop } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const current = useRef<string | null>(null);
  useEffect(
    () => () => {
      if (current.current) URL.revokeObjectURL(current.current);
    },
    [],
  );

  async function pick(file: File | undefined) {
    if (input.current) input.current.value = ''; // picking the same file again must fire `change`
    if (!file) return;
    const check = validateFile(file);
    if (!check.ok) {
      setError(check.message);
      return;
    }
    try {
      const { width, height } = await readSize(file);
      const crop = centerSquare(width, height);
      if (current.current) URL.revokeObjectURL(current.current);
      current.current = URL.createObjectURL(file);
      setPreview({ url: current.current, crop });
      setError(null);
      onPick({ file, crop });
    } catch {
      setError(NOT_READABLE);
    }
  }

  const { x, y, width, height } = preview?.crop ?? {};
  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img
          src={preview.url}
          alt="新しいアイコンのプレビュー"
          data-testid="avatar-preview"
          data-crop={`${x},${y},${width},${height}`}
          className={SIZE}
        />
      ) : avatarUrl ? (
        <img src={avatarUrl} alt="現在のアイコン" className={SIZE} />
      ) : (
        <span
          role="img"
          aria-label="現在のアイコン"
          className={`${SIZE} flex items-center justify-center text-[length:var(--font-size-xl)] font-bold text-text-secondary`}
        >
          {initial}
        </span>
      )}
      <div className="flex flex-col gap-1">
        {/* The real file input is the keyboard target, so the chooser opens even before hydration. */}
        <label className="inline-flex min-h-[var(--tap-min)] cursor-pointer items-center rounded-lg border border-border px-4 font-bold has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-default has-[:disabled]:opacity-50">
          <input
            ref={input}
            type="file"
            accept="image/*"
            disabled={disabled}
            className="sr-only"
            onChange={(e) => void pick(e.currentTarget.files?.[0])}
          />
          アイコンを変更
        </label>
        {error !== null && (
          <p role="alert" className="text-[length:var(--font-size-sm)] text-danger">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
