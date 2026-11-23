export const COPIED_MESSAGE = 'リンクをコピーしました';
export const COPY_FAILED_MESSAGE = 'リンクをコピーできませんでした';

export type CopyResult = { ok: true; message: string } | { ok: false; message: string };

/** Writes the absolute URL of the post to the clipboard; a refusal or a missing clipboard is a failure, never a throw. */
export async function copyPostLink(
  postId: string,
  origin: string,
  clipboard: { writeText(text: string): Promise<void> } | undefined,
): Promise<CopyResult> {
  try {
    if (!clipboard) throw new Error('no clipboard');
    await clipboard.writeText(new URL(`/p/${postId}`, origin).href);
    return { ok: true, message: COPIED_MESSAGE };
  } catch {
    return { ok: false, message: COPY_FAILED_MESSAGE };
  }
}
