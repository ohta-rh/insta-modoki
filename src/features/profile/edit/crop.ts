import type { Crop } from '../../media-upload';

/** The largest square in the photo, centered (the odd pixel goes to the right / bottom). */
export function centerSquare(width: number, height: number): Crop {
  const side = Math.min(width, height);
  return {
    x: Math.floor((width - side) / 2),
    y: Math.floor((height - side) / 2),
    width: side,
    height: side,
  };
}
