import { thumbHashToDataURL } from 'thumbhash';

/** A ThumbHash is 5 to 25 bytes (docs/architecture/data-model.md); anything else is not one. */
const MIN_BYTES = 5;
const MAX_BYTES = 25;

/** The blurred placeholder (a PNG data URL) of a base64 ThumbHash, or null when it is not valid. */
export function thumbhashDataUrl(base64: string): string | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    if (bytes.length < MIN_BYTES || bytes.length > MAX_BYTES) return null;
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}
