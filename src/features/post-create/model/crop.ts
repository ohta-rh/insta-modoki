export type Ratio = '1:1' | '4:5';
export type Size = { width: number; height: number };
/** Where the crop window sits in the photo: 0 is the top / left edge, 1 the bottom / right edge. */
export type Focus = { x: number; y: number };
/** A crop rectangle in the pixels of the picked photo (the shape `processImage` takes). */
export type CropRect = { x: number; y: number; width: number; height: number };

export const RATIOS: Ratio[] = ['1:1', '4:5'];
export const CENTER: Focus = { x: 0.5, y: 0.5 };
/** One arrow key press moves the crop window by this many screen pixels. */
export const KEY_STEP_PX = 10;

const PARTS: Record<Ratio, [number, number]> = { '1:1': [1, 1], '4:5': [4, 5] };
const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const round6 = (n: number): number => Math.round(n * 1e6) / 1e6;

/**
 * The largest crop of the ratio that fits in the photo, placed by `focus`. The sides are whole
 * multiples of the ratio parts (4:5 gives 480x600, never 480x601), so `width / height` is exact.
 */
export function cropRect(size: Size, ratio: Ratio, focus: Focus): CropRect {
  const [rw, rh] = PARTS[ratio];
  const fit = Math.min(size.width / rw, size.height / rh);
  const unit = fit >= 1 ? Math.floor(fit) : fit;
  const width = Math.min(size.width, Math.max(1, Math.round(unit * rw)));
  const height = Math.min(size.height, Math.max(1, Math.round(unit * rh)));
  return {
    x: Math.round(clamp01(focus.x) * (size.width - width)),
    y: Math.round(clamp01(focus.y) * (size.height - height)),
    width,
    height,
  };
}

/**
 * The frame the photo is shown in (`cover`: the photo fills it and the excess is hidden): its
 * height for `frameWidth`, the photo's scale, and how many screen pixels stick out on each axis.
 */
export function frameLayout(size: Size, frameWidth: number, ratio: Ratio) {
  const [rw, rh] = PARTS[ratio];
  const frameHeight = (frameWidth * rh) / rw;
  const scale = Math.max(frameWidth / size.width, frameHeight / size.height);
  return {
    frameHeight,
    scale,
    overflowX: Math.max(0, size.width * scale - frameWidth),
    overflowY: Math.max(0, size.height * scale - frameHeight),
  };
}

/** Moves the window by `delta` screen pixels; an axis with no overflow cannot move. */
export function moveFocus(
  focus: Focus,
  delta: { x: number; y: number },
  overflow: { x: number; y: number },
): Focus {
  return {
    x: overflow.x > 0 ? round6(clamp01(focus.x + delta.x / overflow.x)) : focus.x,
    y: overflow.y > 0 ? round6(clamp01(focus.y + delta.y / overflow.y)) : focus.y,
  };
}
