import { rgbaToThumbHash } from 'thumbhash';
import type { AppErrorCode } from '../../../shared/errors';
import { fitWithin, MAX_EDGE, variantSize, VARIANT_WIDTHS, type Size } from './resize';

/** A crop rectangle in the pixels of the picked photo. */
export type Crop = { x: number; y: number; width: number; height: number };

export type Variant = 'orig' | 'w320' | 'w640' | 'w1080';
export type ProcessedImage = {
  /** Pixels of the original (after shrinking and cropping). */
  width: number;
  height: number;
  /** base64 of the ThumbHash (25 bytes or fewer). */
  thumbhash: string;
  blobs: Record<Variant, Blob>;
};

export const WEBP_QUALITY = 0.82;
export const THUMBHASH_EDGE = 100;
export const NOT_READABLE_MESSAGE = 'この形式の写真は、このブラウザでは読み込めません';
export const NOT_ENCODABLE_MESSAGE = 'このブラウザでは写真を変換できません';

/** The slice of an ImageBitmap this module uses. */
export type BitmapLike = { width: number; height: number; close?(): void };
type Context2d = {
  imageSmoothingQuality: string;
  drawImage(
    image: unknown,
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    dx: number,
    dy: number,
    dw: number,
    dh: number,
  ): void;
  getImageData(x: number, y: number, w: number, h: number): { data: Uint8ClampedArray };
};
export type CanvasLike = {
  getContext(type: '2d'): Context2d | null;
  convertToBlob(options: { type: string; quality: number }): Promise<Blob>;
};

/** The browser features used, replaceable so the logic runs under Node in unit tests. */
export type ImageDeps = {
  createBitmap(blob: Blob): Promise<BitmapLike>;
  createCanvas(width: number, height: number): CanvasLike;
};

/** Same shape as an AppError (`code`, `message`), thrown in the browser. */
export class UploadError extends Error {
  readonly code: AppErrorCode | 'INTERNAL';
  constructor(message: string, code: AppErrorCode | 'INTERNAL' = 'VALIDATION') {
    super(message);
    this.name = 'UploadError';
    this.code = code;
  }
}

const browserDeps: ImageDeps = {
  // 'from-image' applies the EXIF orientation, so the redrawn pixels are upright.
  createBitmap: (blob) => createImageBitmap(blob, { imageOrientation: 'from-image' }),
  createCanvas: (width, height) => new OffscreenCanvas(width, height) as unknown as CanvasLike,
};

function draw(deps: ImageDeps, bitmap: BitmapLike, src: Crop, to: Size) {
  const canvas = deps.createCanvas(to.width, to.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new UploadError(NOT_ENCODABLE_MESSAGE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, src.x, src.y, src.width, src.height, 0, 0, to.width, to.height);
  return { canvas, ctx };
}

/** ThumbHash of the region, drawn at 100px or less on the long edge. Returns base64. */
export function encodeThumbHash(
  bitmap: BitmapLike,
  region: Crop,
  deps: ImageDeps = browserDeps,
): string {
  const size = fitWithin(region.width, region.height, THUMBHASH_EDGE);
  const { ctx } = draw(deps, bitmap, region, size);
  const rgba = ctx.getImageData(0, 0, size.width, size.height).data;
  const hash = rgbaToThumbHash(size.width, size.height, rgba);
  let binary = '';
  for (const byte of hash) binary += String.fromCharCode(byte);
  return btoa(binary);
}

/**
 * Redraws the photo (cropped if asked) as WebP at the original size (long edge 2048 or less) and at
 * 1080 / 640 / 320 wide. Drawing again drops every EXIF tag, GPS included, and nothing is enlarged.
 */
export async function processImage(
  file: Blob,
  options: { crop?: Crop } = {},
  deps: ImageDeps = browserDeps,
): Promise<ProcessedImage> {
  let bitmap: BitmapLike;
  try {
    bitmap = await deps.createBitmap(file);
  } catch {
    throw new UploadError(NOT_READABLE_MESSAGE);
  }
  try {
    const src: Crop = options.crop ?? { x: 0, y: 0, width: bitmap.width, height: bitmap.height };
    const orig = fitWithin(src.width, src.height, MAX_EDGE);
    const targets: [Variant, Size][] = [
      ['orig', orig],
      ['w1080', variantSize(orig, VARIANT_WIDTHS.w1080)],
      ['w640', variantSize(orig, VARIANT_WIDTHS.w640)],
      ['w320', variantSize(orig, VARIANT_WIDTHS.w320)],
    ];
    const blobs = {} as Record<Variant, Blob>;
    for (const [name, size] of targets) {
      const { canvas } = draw(deps, bitmap, src, size);
      const blob = await canvas.convertToBlob({ type: 'image/webp', quality: WEBP_QUALITY });
      if (blob.type !== 'image/webp') throw new UploadError(NOT_ENCODABLE_MESSAGE);
      blobs[name] = blob;
    }
    return {
      width: orig.width,
      height: orig.height,
      thumbhash: encodeThumbHash(bitmap, src, deps),
      blobs,
    };
  } finally {
    bitmap.close?.();
  }
}
