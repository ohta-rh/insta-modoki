'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { UploadError, uploadImages, validateFile } from '../../media-upload';
import type { UploadedImage } from '../../media-upload';
import { charLength } from '../../../shared/text';
import { createPostAction } from '../api/actions';
import { CENTER, cropRect, RATIOS, type Focus, type Ratio } from '../model/crop';
import { MAX_ALT_TEXT, MAX_CAPTION, MAX_PHOTOS } from '../model/limits';
import { CaptionField } from './CaptionField';
import { PhotoList, type PhotoAction, type PhotoItem } from './PhotoList';

const UPLOAD_FAILED = 'アップロードに失敗しました。もう一度お試しください';
const NOT_READABLE = 'この形式の写真は、このブラウザでは読み込めません';
const ERROR = 'text-[length:var(--font-size-sm)] text-red-700';
const SECONDARY =
  'min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold disabled:opacity-50';

/** A picked photo and, once stored, what the server needs to know about it. */
type Photo = PhotoItem & {
  file: File;
  /** The stored files, valid only while `signature` still equals the photo's current crop. */
  stored?: { signature: string; image: UploadedImage };
};

const signatureOf = (photo: Photo, ratio: Ratio): string =>
  `${ratio}:${Object.values(cropRect(photo.size, ratio, photo.focus)).join(',')}`;

/** The photo's pixels after the EXIF turn, the way `processImage` will see them. */
async function readSize(file: File): Promise<{ width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}

/**
 * The /create screen: pick photos (up to 10), choose 1:1 or 4:5, slide the crop, add alternative
 * text and a caption, then post. A failure keeps everything and keeps what is already stored, so
 * pressing 投稿 again sends only what changed. The same `clientRequestId` is used for every try.
 */
export function CreatePostForm() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [clientRequestId] = useState(() => crypto.randomUUID());
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [ratio, setRatio] = useState<Ratio>('1:1');
  const [caption, setCaption] = useState('');
  const [pickErrors, setPickErrors] = useState<string[]>([]);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  const [focusRequest, setFocusRequest] = useState<{ id: string; action: PhotoAction } | null>(
    null,
  );

  const captionOver = charLength(caption) > MAX_CAPTION;
  const altOver = photos.some((p) => charLength(p.altText) > MAX_ALT_TEXT);
  const canPost = photos.length > 0 && !captionOver && !altOver && !busy && !reading;
  const locked = busy || reading;

  async function pick(list: FileList | null) {
    const files = Array.from(list ?? []);
    if (input.current) input.current.value = ''; // picking the same file again must fire `change`
    setReading(true);
    const errors: string[] = [];
    const added: Photo[] = [];
    let capped = false;
    for (const file of files) {
      const check = validateFile(file);
      if (!check.ok) {
        errors.push(`${file.name}: ${check.message}`);
      } else if (photos.length + added.length >= MAX_PHOTOS) {
        capped = true;
      } else {
        try {
          added.push({
            id: crypto.randomUUID(),
            file,
            name: file.name,
            url: URL.createObjectURL(file),
            size: await readSize(file),
            focus: CENTER,
            altText: '',
          });
        } catch {
          errors.push(`${file.name}: ${NOT_READABLE}`);
        }
      }
    }
    if (capped) errors.unshift(`写真は ${MAX_PHOTOS} 枚までです`);
    setPickErrors(errors);
    setPhotos((prev) => [...prev, ...added]);
    setReading(false);
  }

  function update(id: string, change: Partial<Photo>) {
    setPhotos((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }

  function move(id: string, by: -1 | 1) {
    setPhotos((prev) => {
      const from = prev.findIndex((p) => p.id === id);
      const to = from + by;
      if (from < 0 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to]!, next[from]!];
      return next;
    });
    setFocusRequest({ id, action: by < 0 ? 'prev' : 'next' });
  }

  function remove(id: string) {
    const at = photos.findIndex((p) => p.id === id);
    const gone = photos[at];
    if (gone) URL.revokeObjectURL(gone.url);
    const rest = photos.filter((p) => p.id !== id);
    setPhotos(rest);
    const neighbour = rest[Math.min(at, rest.length - 1)];
    if (neighbour) setFocusRequest({ id: neighbour.id, action: 'remove' });
    else input.current?.focus();
  }

  async function post() {
    setBusy(true);
    setFailure(null);
    try {
      // Photos stored by an earlier try, with the same crop, are not sent again.
      const stale = photos.filter((p) => p.stored?.signature !== signatureOf(p, ratio));
      const stored = new Map<string, { signature: string; image: UploadedImage }>();
      if (stale.length > 0) {
        const images = await uploadImages(
          stale.map((p) => p.file),
          { crops: stale.map((p) => cropRect(p.size, ratio, p.focus)) },
        );
        stale.forEach((p, i) =>
          stored.set(p.id, { signature: signatureOf(p, ratio), image: images[i]! }),
        );
        setPhotos((prev) => prev.map((p) => ({ ...p, stored: stored.get(p.id) ?? p.stored })));
      }
      const media = photos.map((p) => {
        const { image } = stored.get(p.id) ?? p.stored!;
        return {
          key: image.key,
          width: image.width,
          height: image.height,
          thumbhash: image.thumbhash,
          altText: p.altText,
        };
      });
      const result = await createPostAction({ caption, media, clientRequestId });
      if (!result.ok) {
        setFailure(result.error.message);
        setBusy(false);
        return;
      }
      // Stay locked while the next screen loads.
      router.push(`/p/${result.postId}`);
    } catch (error) {
      setFailure(error instanceof UploadError ? error.message : UPLOAD_FAILED);
      setBusy(false);
    }
  }

  return (
    <form
      className="mx-auto flex w-full max-w-[640px] flex-col gap-5 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (canPost) void post();
      }}
    >
      <h1 className="text-[length:var(--font-size-xl)] font-bold">投稿を作成</h1>
      <fieldset disabled={locked} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            {/* The real file input is the keyboard target, so the chooser opens even before hydration. */}
            <label
              className={`${SECONDARY} inline-flex cursor-pointer items-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-default`}
            >
              <input
                ref={input}
                type="file"
                accept="image/*"
                multiple
                className="sr-only"
                onChange={(e) => void pick(e.currentTarget.files)}
              />
              写真を選ぶ
            </label>
            <span className="text-[length:var(--font-size-sm)] text-text-muted">
              {photos.length} / {MAX_PHOTOS} 枚
            </span>
          </div>
          {pickErrors.length > 0 && (
            <ul role="alert" className={`${ERROR} list-none`}>
              {pickErrors.map((message, i) => (
                <li key={i}>{message}</li>
              ))}
            </ul>
          )}
        </div>

        <fieldset className="flex items-center gap-4">
          <legend className="mb-1 text-[length:var(--font-size-sm)] font-bold">比率</legend>
          {RATIOS.map((r) => (
            <label key={r} className="flex min-h-[var(--tap-min)] items-center gap-2">
              <input
                type="radio"
                name="ratio"
                value={r}
                checked={ratio === r}
                onChange={() => setRatio(r)}
              />
              {r}
            </label>
          ))}
        </fieldset>

        <PhotoList
          photos={photos}
          ratio={ratio}
          disabled={locked}
          onMove={move}
          onRemove={remove}
          onAltText={(id, altText) => update(id, { altText })}
          onFocusChange={(id: string, focus: Focus) => update(id, { focus })}
          focusRequest={focusRequest}
        />

        <CaptionField value={caption} onChange={setCaption} />
      </fieldset>

      {failure !== null && (
        <p role="alert" className={ERROR}>
          {failure}
        </p>
      )}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={!canPost}
          aria-describedby={photos.length === 0 ? 'submit-hint' : undefined}
          className="min-h-[var(--tap-min)] rounded-lg bg-indigo px-6 font-bold text-white disabled:opacity-50"
        >
          投稿
        </button>
        {photos.length === 0 && (
          <p id="submit-hint" className="text-[length:var(--font-size-sm)] text-text-secondary">
            写真を 1 枚以上選んでください
          </p>
        )}
        {busy && (
          <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
            投稿しています…
          </p>
        )}
      </div>
    </form>
  );
}
