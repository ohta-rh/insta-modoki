import { thumbHashToAverageRGBA, thumbHashToDataURL } from 'thumbhash';

/** A ThumbHash is 5 to 25 bytes (docs/architecture/data-model.md); anything else is not one. */
const MIN_BYTES = 5;
const MAX_BYTES = 25;

/** The bytes of a base64 ThumbHash, or null when it is not one. */
function thumbhashBytes(base64: string): Uint8Array | null {
  try {
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return bytes.length < MIN_BYTES || bytes.length > MAX_BYTES ? null : bytes;
  } catch {
    return null;
  }
}

/** The blurred placeholder (a PNG data URL) of a base64 ThumbHash, or null when it is not valid. */
export function thumbhashDataUrl(base64: string): string | null {
  const bytes = thumbhashBytes(base64);
  if (!bytes) return null;
  try {
    return thumbHashToDataURL(bytes);
  } catch {
    return null;
  }
}

/** The average colour of a base64 ThumbHash as `rgb(r g b)`, or null when it is not valid. */
export function thumbhashAverageColor(base64: string): string | null {
  const bytes = thumbhashBytes(base64);
  if (!bytes) return null;
  try {
    const { r, g, b } = thumbHashToAverageRGBA(bytes);
    const c = (x: number) => Math.min(255, Math.max(0, Math.round(x * 255)));
    return `rgb(${c(r)} ${c(g)} ${c(b)})`;
  } catch {
    return null;
  }
}
