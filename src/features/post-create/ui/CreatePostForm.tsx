'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { UploadError, uploadImages, validateFile } from '../../media-upload';
import type { UploadedImage } from '../../media-upload';
import { charLength } from '../../../shared/text';
import { useFilesPickedBeforeHydration } from '../../../shared/ui/files-picked-before-hydration';
import { createPostAction } from '../api/actions';
import { CENTER, cropRect, RATIOS, type Focus, type Ratio } from '../model/crop';
import { MAX_ALT_TEXT, MAX_CAPTION, MAX_PHOTOS } from '../model/limits';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  PlusSquareIcon,
} from '../../../shared/ui/icons';
import { CaptionField } from './CaptionField';
import { CropFrame } from './CropFrame';
import { PhotoList, type PhotoAction, type PhotoItem } from './PhotoList';

const UPLOAD_FAILED = 'アップロードに失敗しました。もう一度お試しください';
const NOT_READABLE = 'この形式の写真は、このブラウザでは読み込めません';
const ERROR = 'text-[length:var(--font-size-sm)] text-danger';
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
export type CreatePostFormProps = {
  /** `page` is the one-column form of /create; `modal` is the stepped flow inside the create modal. */
  variant?: 'page' | 'modal';
  /** The signed-in user, shown above the caption in the modal. */
  viewer?: { username: string } | null;
  /** Tells the modal how many photos are picked (it asks before discarding them). */
  onPhotoCount?: (count: number) => void;
  /** Tells the modal a share is running (it ignores close requests until it settles). */
  onBusyChange?: (busy: boolean) => void;
  /** The modal's close (the narrow screen's × in the header). */
  onClose?: () => void;
};

type Step = 'pick' | 'crop' | 'caption';

export function CreatePostForm({
  variant = 'page',
  viewer = null,
  onPhotoCount,
  onBusyChange,
  onClose,
}: CreatePostFormProps = {}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  useFilesPickedBeforeHydration(input, (files) => void pick(files));
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

  const [step, setStep] = useState<Step>('pick');
  const [current, setCurrent] = useState(0);
  const [ratioOpen, setRatioOpen] = useState(false);
  const modal = variant === 'modal';
  useEffect(() => {
    onPhotoCount?.(photos.length);
  }, [onPhotoCount, photos.length]);

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
    if (modal && photos.length + added.length > 0) setStep((s) => (s === 'pick' ? 'crop' : s));
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
    setCurrent((c) => Math.min(c, Math.max(0, rest.length - 1)));
    if (neighbour) setFocusRequest({ id: neighbour.id, action: 'remove' });
    else if (modal) {
      setStep('pick');
      requestAnimationFrame(() => input.current?.focus());
    } else input.current?.focus();
  }

  /** Sets `busy` and tells the modal at once, so a close request in the same tick is already ignored. */
  function markBusy(value: boolean) {
    setBusy(value);
    onBusyChange?.(value);
  }

  async function post() {
    markBusy(true);
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
        markBusy(false);
        return;
      }
      // Stay locked while the next screen loads.
      router.push(`/p/${result.postId}`);
    } catch (error) {
      setFailure(error instanceof UploadError ? error.message : UPLOAD_FAILED);
      markBusy(false);
    }
  }

  if (modal) {
    return (
      <ModalFlow
        step={step}
        setStep={setStep}
        photos={photos}
        current={current}
        setCurrent={setCurrent}
        ratio={ratio}
        setRatio={setRatio}
        ratioOpen={ratioOpen}
        setRatioOpen={setRatioOpen}
        caption={caption}
        setCaption={setCaption}
        pickErrors={pickErrors}
        failure={failure}
        busy={busy}
        locked={locked}
        canPost={canPost}
        viewer={viewer}
        input={input}
        onPick={(files) => void pick(files)}
        onClose={onClose}
        onPost={() => void post()}
        listProps={{
          photos,
          ratio,
          disabled: locked,
          onMove: move,
          onRemove: remove,
          onAltText: (id, altText) => update(id, { altText }),
          onFocusChange: (id: string, focus: Focus) => update(id, { focus }),
          focusRequest,
          compact: true,
        }}
        onFocusChange={(id, focus) => update(id, { focus })}
      />
    );
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
            <span className="text-[length:var(--font-size-sm)] text-text-secondary">
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
                className="h-[var(--tap-min)] w-[var(--tap-min)]"
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

const HEADER_BUTTON =
  'flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center px-3 outline-offset-[-2px] disabled:opacity-50';
const ACTION = `${HEADER_BUTTON} text-[length:var(--font-size-sm)] font-semibold text-indigo`;
const SURFACE =
  'relative aspect-square w-full shrink-0 overflow-hidden bg-surface nav:h-[var(--create-s)] nav:w-[var(--create-s)]';
const ASPECT_CLASS: Record<Ratio, string> = { '1:1': 'aspect-square', '4:5': 'aspect-[4/5]' };

type ModalFlowProps = {
  step: Step;
  setStep: (step: Step) => void;
  photos: Photo[];
  current: number;
  setCurrent: (index: number) => void;
  ratio: Ratio;
  setRatio: (ratio: Ratio) => void;
  ratioOpen: boolean;
  setRatioOpen: (open: boolean) => void;
  caption: string;
  setCaption: (caption: string) => void;
  pickErrors: string[];
  failure: string | null;
  busy: boolean;
  locked: boolean;
  canPost: boolean;
  viewer: { username: string } | null;
  input: React.RefObject<HTMLInputElement | null>;
  onPick: (files: FileList | null) => void;
  onClose?: () => void;
  onPost: () => void;
  listProps: Parameters<typeof PhotoList>[0];
  onFocusChange: (id: string, focus: Focus) => void;
};

/** The three steps of the create modal: pick, crop, caption. All state lives in `CreatePostForm`. */
function ModalFlow(p: ModalFlowProps) {
  const { step, photos, ratio, locked } = p;
  const photo = photos[Math.min(p.current, photos.length - 1)];
  const heading = step === 'crop' ? '切り取る' : '新規投稿を作成';
  const pickForward = step === 'pick' && photos.length > 0;
  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        if (step === 'caption' && p.canPost) p.onPost();
      }}
    >
      <header className="grid h-11 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-border">
        <div className="flex justify-start">
          {step === 'pick' ? (
            <button
              type="button"
              onClick={p.onClose}
              className={`${HEADER_BUTTON} nav:hidden`}
              aria-label="閉じる"
            >
              <CloseIcon />
            </button>
          ) : (
            <button
              type="button"
              disabled={locked}
              onClick={() => p.setStep(step === 'caption' ? 'crop' : 'pick')}
              className={HEADER_BUTTON}
              aria-label="戻る"
            >
              <ChevronLeftIcon />
            </button>
          )}
        </div>
        <h2 className="px-2 text-[length:var(--font-size-md)] font-semibold">{heading}</h2>
        <div className="flex justify-end">
          {step === 'caption' ? (
            <button key="share" type="submit" disabled={!p.canPost} className={ACTION}>
              シェア
            </button>
          ) : step === 'crop' || pickForward ? (
            <button
              key="next"
              type="button"
              disabled={locked}
              className={ACTION}
              onClick={() => p.setStep(step === 'pick' ? 'crop' : 'caption')}
            >
              次へ
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto nav:flex-row nav:overflow-visible">
        <div data-testid="create-surface" className={SURFACE}>
          {step === 'pick' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-4 text-center">
              <PlusSquareIcon size={96} strokeWidth={1} />
              <p className="text-[length:var(--font-size-xl)]">写真を選んでください</p>
              {/* The real file input is the keyboard target, so the chooser opens even before hydration. */}
              <label className="inline-flex min-h-[var(--tap-min)] cursor-pointer items-center rounded-lg bg-indigo px-4 font-semibold text-white has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-text">
                <input
                  ref={p.input}
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => p.onPick(e.currentTarget.files)}
                />
                コンピューターから選択
              </label>
              {p.pickErrors.length > 0 && (
                <ul role="alert" className={`${ERROR} list-none`}>
                  {p.pickErrors.map((message, i) => (
                    <li key={i}>{message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {step === 'crop' && photo && (
            <>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className={`h-full max-w-full ${ASPECT_CLASS[ratio]}`}>
                  <CropFrame
                    key={photo.id}
                    bare
                    number={p.current + 1}
                    src={photo.url}
                    size={photo.size}
                    ratio={ratio}
                    focus={photo.focus}
                    disabled={locked}
                    onFocusChange={(focus) => p.onFocusChange(photo.id, focus)}
                  />
                </div>
              </div>
              <div className="absolute bottom-3 left-3">
                <button
                  type="button"
                  aria-label="比率を選ぶ"
                  aria-expanded={p.ratioOpen}
                  onClick={() => p.setRatioOpen(!p.ratioOpen)}
                  className="flex h-[var(--tap-min)] w-[var(--tap-min)] items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
                  </svg>
                </button>
                {p.ratioOpen && (
                  <div
                    role="radiogroup"
                    aria-label="比率"
                    className="absolute bottom-12 left-0 flex rounded-lg bg-black/80 text-white"
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        p.setRatioOpen(false);
                      }
                    }}
                  >
                    {RATIOS.map((r) => (
                      <label
                        key={r}
                        className="relative flex min-h-[var(--tap-min)] min-w-[var(--tap-min)] items-center justify-center px-3 has-[:checked]:font-bold has-[:checked]:underline"
                      >
                        <input
                          type="radio"
                          name="ratio"
                          value={r}
                          checked={ratio === r}
                          onChange={() => {
                            p.setRatio(r);
                            p.setRatioOpen(false);
                          }}
                          className="absolute inset-0 cursor-pointer opacity-0"
                        />
                        {r}
                      </label>
                    ))}
                  </div>
                )}
              </div>
              {p.current > 0 && (
                <button
                  type="button"
                  aria-label="前の写真"
                  onClick={() => p.setCurrent(p.current - 1)}
                  className="absolute left-3 top-1/2 flex h-[var(--tap-min)] w-[var(--tap-min)] -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <ChevronLeftIcon />
                </button>
              )}
              {p.current < photos.length - 1 && (
                <button
                  type="button"
                  aria-label="次の写真"
                  onClick={() => p.setCurrent(p.current + 1)}
                  className="absolute right-3 top-1/2 flex h-[var(--tap-min)] w-[var(--tap-min)] -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white"
                >
                  <ChevronRightIcon />
                </button>
              )}
            </>
          )}
          {step === 'caption' && photos[0] && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className={`h-full max-w-full overflow-hidden ${ASPECT_CLASS[ratio]}`}>
                <img
                  src={photos[0].url}
                  alt=""
                  className="h-full w-full object-cover"
                  style={{
                    objectPosition: `${photos[0].focus.x * 100}% ${photos[0].focus.y * 100}%`,
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {step === 'caption' && (
          <fieldset
            disabled={locked}
            data-testid="create-side"
            className="flex min-w-0 flex-col gap-4 p-4 nav:h-[var(--create-s)] nav:w-[340px] nav:shrink-0 nav:overflow-y-auto nav:border-l nav:border-border"
          >
            <div className="flex items-center gap-3">
              <span
                data-testid="avatar-initial"
                aria-hidden="true"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-[length:var(--font-size-sm)] font-semibold"
              >
                {Array.from(p.viewer?.username ?? '')[0]?.toUpperCase()}
              </span>
              <span className="truncate text-[length:var(--font-size-sm)] font-semibold">
                {p.viewer?.username}
              </span>
            </div>
            <CaptionField value={p.caption} onChange={p.setCaption} />
            <PhotoList {...p.listProps} />
            {p.failure !== null && (
              <p role="alert" className={ERROR}>
                {p.failure}
              </p>
            )}
            {p.busy && (
              <p role="status" className="text-[length:var(--font-size-sm)] text-text-secondary">
                シェアしています
              </p>
            )}
          </fieldset>
        )}
      </div>
    </form>
  );
}
