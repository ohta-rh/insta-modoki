'use client';

import { useRef, useState } from 'react';
import { useFilesPickedBeforeHydration } from '../../../shared/ui/files-picked-before-hydration';
import { MAX_FILES } from '../model/limits';
import { uploadImages, type UploadedImage } from '../model/upload-images';
import { validateFile } from '../model/validate-file';

const BUTTON =
  'min-h-[var(--tap-min)] rounded-lg bg-indigo px-4 font-bold text-white disabled:opacity-50';
const SECONDARY =
  'min-h-[var(--tap-min)] rounded-lg border border-border px-4 font-bold disabled:opacity-50';
const ERROR = 'text-[length:var(--font-size-sm)] text-danger';

type Rejection = { name: string; message: string };

export type ImagePickerProps = {
  /** Called with `{ key, width, height, thumbhash }` per photo once every file is stored. */
  onUploaded: (images: UploadedImage[]) => void;
};

/**
 * Picks photos, rejects the unusable ones with a reason before anything is sent, then converts and
 * uploads the rest on "アップロード". A failed upload keeps the selection so it can be retried.
 */
export function ImagePicker({ onUploaded }: ImagePickerProps) {
  const input = useRef<HTMLInputElement>(null);
  useFilesPickedBeforeHydration(input, pick);
  const [files, setFiles] = useState<File[]>([]);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [progress, setProgress] = useState<number[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function pick(list: FileList | null) {
    const accepted: File[] = [];
    const rejected: Rejection[] = [];
    for (const file of Array.from(list ?? [])) {
      const check = validateFile(file);
      if (!check.ok) rejected.push({ name: file.name, message: check.message });
      else if (accepted.length >= MAX_FILES) {
        rejected.push({ name: file.name, message: `写真は ${MAX_FILES} 枚までです` });
      } else accepted.push(file);
    }
    setFiles(accepted);
    setRejections(rejected);
    setProgress(null);
    setFailure(null);
    // Picking the same file again must fire `change` again.
    if (input.current) input.current.value = '';
  }

  async function start() {
    setBusy(true);
    setFailure(null);
    setProgress(files.map(() => 0));
    try {
      const images = await uploadImages(files, {
        onProgress: (index, fraction) =>
          setProgress((prev) => (prev ?? []).map((v, i) => (i === index ? fraction : v))),
      });
      setProgress(files.map(() => 1));
      setFiles([]);
      onUploaded(images);
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error.message
          : 'アップロードに失敗しました。もう一度お試しください',
      );
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {/* The real file input is the keyboard target, so the chooser opens even before hydration. */}
        <label
          className={`${SECONDARY} inline-flex cursor-pointer items-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:disabled]:cursor-default has-[:disabled]:opacity-50`}
        >
          <input
            ref={input}
            type="file"
            accept="image/*"
            multiple
            disabled={busy}
            className="sr-only"
            onChange={(e) => pick(e.currentTarget.files)}
          />
          写真を選ぶ
        </label>
        <button
          type="button"
          className={BUTTON}
          onClick={start}
          disabled={busy || files.length === 0}
        >
          アップロード
        </button>
      </div>
      {rejections.length > 0 && (
        <div role="alert">
          <ul className={`${ERROR} list-disc pl-5`}>
            {rejections.map((r, i) => (
              <li key={i}>{`${r.name}: ${r.message}`}</li>
            ))}
          </ul>
        </div>
      )}
      {failure !== null && (
        <p role="alert" className={ERROR}>
          {failure}
        </p>
      )}
      {files.length > 0 && (
        <ul aria-label="選んだ写真" className="flex flex-col gap-2">
          {files.map((file, i) => (
            <li key={`${file.name}-${i}`} className="flex flex-col gap-1">
              <span>{file.name}</span>
              {progress !== null && (
                <progress
                  aria-label={`${file.name} のアップロードの進捗`}
                  value={progress[i] ?? 0}
                  max={1}
                  className="w-full"
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
