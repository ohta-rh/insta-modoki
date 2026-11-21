import sharp from 'sharp';
import { rgbaToThumbHash } from 'thumbhash';
import { mulberry32 } from './generate.ts';

// Own artwork only (ADR-0003): shapes drawn from the design-system palette, rendered with sharp.
// Runs in Node (the seed scripts), never in the app's Workers runtime (ADR-0011).
const COLORS = [
  { name: '青緑', hex: '#0bb8a9' },
  { name: '藍', hex: '#4f46c8' },
  { name: '珊瑚', hex: '#ff6b5e' },
  { name: '青', hex: '#2b6cf6' },
] as const;
const PALE = ['#ffffff', '#f4f6f9', '#e5e7eb'] as const;
const SHAPES = ['円', 'アーチ', '窓'] as const;
const WIDTHS = [320, 640, 1080] as const;

export type GeneratedImage = {
  orig: Uint8Array;
  w320: Uint8Array;
  w640: Uint8Array;
  w1080: Uint8Array;
  width: number;
  height: number;
  altText: string;
  /** base64 */
  thumbhash: string;
};

const n = (v: number) => Math.round(v * 10) / 10;

/** One image, fully determined by `seed`: the same seed gives the same bytes. */
export async function generateImage(seed: number): Promise<GeneratedImage> {
  const rng = mulberry32(seed);
  const int = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  const width = 1080;
  const height = rng() < 0.5 ? 1080 : 1350;
  const bg = COLORS[int(0, COLORS.length - 1)]!;
  const bg2 = COLORS[int(0, COLORS.length - 1)]!;
  const pale = PALE[int(0, PALE.length - 1)]!;

  const used = new Map<string, number>();
  const parts: string[] = [];
  for (let i = int(3, 6); i > 0; i -= 1) {
    const shape = SHAPES[int(0, SHAPES.length - 1)]!;
    const fill = i % 2 === 0 ? pale : COLORS[int(0, COLORS.length - 1)]!.hex;
    const opacity = n(0.55 + rng() * 0.4);
    const size = int(160, 440);
    const x = int(0, width - size);
    const y = int(0, height - size);
    used.set(shape, (used.get(shape) ?? 0) + 1);
    if (shape === '円') {
      parts.push(
        `<circle cx="${x + size / 2}" cy="${y + size / 2}" r="${size / 2}" fill="${fill}" fill-opacity="${opacity}"/>`,
      );
    } else if (shape === 'アーチ') {
      const w = size * 0.8;
      parts.push(
        `<path d="M${x} ${y + size}V${y + w / 2}A${w / 2} ${w / 2} 0 0 1 ${x + w} ${y + w / 2}V${y + size}Z" fill="${fill}" fill-opacity="${opacity}"/>`,
      );
    } else {
      const pane = size / 2.2;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const) {
        parts.push(
          `<rect x="${n(x + dx * (pane + 12))}" y="${n(y + dy * (pane + 12))}" width="${n(pane)}" height="${n(pane)}" rx="10" fill="${fill}" fill-opacity="${opacity}"/>`,
        );
      }
    }
  }
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg.hex}"/><stop offset="1" stop-color="${bg2.hex}"/></linearGradient></defs>` +
    `<rect width="${width}" height="${height}" fill="url(#g)"/>${parts.join('')}</svg>`;

  const base = sharp(Buffer.from(svg)).resize(width, height);
  const png = await base.png().toBuffer();
  const orig = await sharp(png).webp({ quality: 90 }).toBuffer();
  const variants = await Promise.all(
    WIDTHS.map((w) =>
      sharp(png)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer(),
    ),
  );
  const { data, info } = await sharp(png)
    .resize(32, 32, { fit: 'inside' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const thumbhash = Buffer.from(rgbaToThumbHash(info.width, info.height, data)).toString('base64');

  const shapes = [...used].map(([shape, count]) => `${shape}${count}個`).join('、');
  const altText = `${bg.name}から${bg2.name}へ変わる背景に、${shapes}を並べた図`;
  return {
    orig: new Uint8Array(orig),
    w320: new Uint8Array(variants[0]!),
    w640: new Uint8Array(variants[1]!),
    w1080: new Uint8Array(variants[2]!),
    width,
    height,
    altText,
    thumbhash,
  };
}
