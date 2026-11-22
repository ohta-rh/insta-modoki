'use client';

import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * The files already in a file input, or `null` when there is no input, no `files`, or none chosen.
 * Pure, so it can be tried without a DOM.
 */
export function filesPickedBeforeHydration(
  input: Pick<HTMLInputElement, 'files'> | null,
): FileList | null {
  const files = input?.files;
  return files && files.length > 0 ? files : null;
}

/**
 * Takes in, once on mount, the files chosen from a native `<input type="file">` before React
 * hydrated it (the browser opens the chooser by itself; a `change` fired before hydration never
 * reaches `onChange`, so the files would stay in the input unseen).
 *
 * `pick` MUST synchronously set `input.value = ''` before its first `await`: that empties the
 * input, so neither StrictMode's second effect run nor a `change` that already reached `onChange`
 * after hydration takes the same files in twice.
 */
export function useFilesPickedBeforeHydration(
  ref: RefObject<HTMLInputElement | null>,
  pick: (files: FileList) => void,
): void {
  const onPicked = useEffectEvent(pick);
  useEffect(() => {
    const files = filesPickedBeforeHydration(ref.current);
    if (files) onPicked(files);
  }, [ref]);
}
