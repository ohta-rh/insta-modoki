'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { processImage } from '../../media-upload';
import { useFilesPickedBeforeHydration } from '../../../shared/ui/files-picked-before-hydration';
import { createStoryAction, requestStoryUploadAction } from '../api/actions';
import {
  composeStory,
  inspectPhoto,
  inspectVideo,
  isVideoFile,
  type ComposeDeps,
} from '../model/compose-story';
import { MAX_ALT_TEXT } from '../model/limits';

const ERROR = 'text-[length:var(--font-size-sm)] text-red-700';
const SECONDARY =
  'min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold disabled:opacity-50';
const ERROR_ID = 'story-error';

const deps: ComposeDeps = {
  process: (file, options) => processImage(file, options),
  fetch: (...args) => fetch(...args),
  requestStoryUpload: requestStoryUploadAction,
  createStory: createStoryAction,
};

/** 5000 -> "0:05". */
const clock = (ms: number): string => {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

type Picked = { file: File; durationMs: number | null; previewUrl: string | null };

/**
 * The /stories/create screen: pick one photo or one MP4 of at most 15 s, add alternative text,
 * post. A refused file is explained at once and sends nothing. A video is shown by its name and
 * length, not played: the page's CSP allows no `blob:` media (src/shared/security/headers.ts).
 */
export function StoryComposer() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [altText, setAltText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [posted, setPosted] = useState(false);
  const [reading, setReading] = useState(false);

  const previewUrl = picked?.previewUrl ?? null;
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function pick(list: FileList | null) {
    const file = list?.[0];
    if (input.current) input.current.value = ''; // picking the same file again must fire `change`
    if (!file) return;
    setReading(true);
    setError(null);
    setPicked(null);
    if (isVideoFile(file)) {
      const check = await inspectVideo(file);
      if (check.ok) setPicked({ file, durationMs: check.durationMs, previewUrl: null });
      else setError(check.message);
    } else {
      const check = inspectPhoto(file);
      if (check.ok) setPicked({ file, durationMs: null, previewUrl: URL.createObjectURL(file) });
      else setError(check.message);
    }
    setReading(false);
  }

  useFilesPickedBeforeHydration(input, (files) => void pick(files));

  async function post() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const result = await composeStory({ file: picked.file, altText }, deps);
    if (!result.ok) {
      setError(result.message);
      setBusy(false);
      return;
    }
    setPosted(true);
    // Stay locked while the home page loads.
    router.push('/');
  }

  const canPost = picked !== null && !busy && !reading && !posted;
  const describedBy = error !== null ? ERROR_ID : undefined;

  return (
    <form
      className="mx-auto flex w-full max-w-[480px] flex-col gap-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canPost) void post();
      }}
    >
      <h1 className="text-[length:var(--font-size-xl)] font-bold">ストーリーを作成</h1>
      <fieldset disabled={busy || reading || posted} className="flex flex-col gap-5">
        <div className="flex flex-col gap-3">
          {/* The real file input is the keyboard target, so the chooser opens even before hydration. */}
          <label
            className={`${SECONDARY} inline-flex w-fit cursor-pointer items-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-default`}
          >
            <input
              ref={input}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,video/mp4"
              className="sr-only"
              aria-describedby={describedBy}
              onChange={(e) => void pick(e.currentTarget.files)}
            />
            写真または動画を選ぶ
          </label>
          {picked?.previewUrl && (
            <img
              src={picked.previewUrl}
              alt={altText || '選んだ写真のプレビュー'}
              className="max-h-64 w-auto max-w-full self-start rounded-lg object-contain"
            />
          )}
          {picked && picked.durationMs !== null && (
            <p className="text-[length:var(--font-size-sm)] text-text-secondary">
              {picked.file.name}（{clock(picked.durationMs)}）
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="story-alt" className="text-[length:var(--font-size-sm)] font-bold">
            代替テキスト
          </label>
          <input
            id="story-alt"
            type="text"
            maxLength={MAX_ALT_TEXT}
            value={altText}
            aria-describedby={describedBy}
            onChange={(e) => setAltText(e.target.value)}
            className="min-h-[var(--tap-min)] rounded-lg border border-border px-3"
          />
        </div>
      </fieldset>

      {error !== null && (
        <p id={ERROR_ID} role="alert" className={ERROR}>
          {error}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canPost}
          className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-6 font-bold text-white disabled:opacity-50"
        >
          投稿
        </button>
        {busy && (
          <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
            投稿しています…
          </p>
        )}
        {posted && (
          <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
            ストーリーを投稿しました
          </p>
        )}
      </div>
    </form>
  );
}
