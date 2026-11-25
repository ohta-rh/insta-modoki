export type Size = { width: number; height: number };

export const MAX_EDGE = 2048;
export const VARIANT_WIDTHS = { w320: 320, w640: 640, w1080: 1080 } as const;

/** Scales so the long edge is at most `max`, keeping the aspect ratio; never enlarges. */
export function fitWithin(width: number, height: number, max: number): Size {
  const long = Math.max(width, height);
  if (long <= max) return { width, height };
  const scale = max / long;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The width of a delivery size: the smaller of the original and the target (no enlarging). */
export function variantWidth(width: number, target: number): number {
  return Math.min(width, target);
}

/** The pixel size of a delivery variant of `orig`, same aspect ratio. */
export function variantSize(orig: Size, target: number): Size {
  const width = variantWidth(orig.width, target);
  if (width === orig.width) return { width: orig.width, height: orig.height };
  return { width, height: Math.max(1, Math.round((orig.height * width) / orig.width)) };
}
