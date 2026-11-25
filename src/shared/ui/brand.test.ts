import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BRAND, FOOTER_NOTICE } from './brand';

const here = fileURLToPath(new URL('.', import.meta.url));
const brandDir = fileURLToPath(new URL('../../../public/brand/', import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listFiles(path) : [path];
  });
}

const files = [...listFiles(here), ...listFiles(brandDir)];
// The forbidden words are assembled at run time so this file does not contain them itself.
const w = (...parts: string[]) => parts.join('');
const FORBIDDEN = [
  new RegExp(w('ins', 'tagram'), 'i'),
  new RegExp(String.raw`\b` + w('in', 'sta') + String.raw`\b`, 'i'),
  new RegExp(String.raw`\b` + w('I', 'G') + String.raw`\b`, 'i'),
  new RegExp(String.raw`\bMeta\b`),
];
const SVG_XMLNS = w('http:', '//www.w3.org/2000/svg');

describe('ブランドの表記', () => {
  it('対象のファイルが見つかる', () => {
    expect(files.some((f) => f.endsWith('logo.svg'))).toBe(true);
    expect(files.some((f) => f.endsWith('nav-items.ts'))).toBe(true);
  });

  it('禁止語が含まれない', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8').replaceAll(FOOTER_NOTICE, '');
      for (const pattern of FORBIDDEN) {
        expect(text, `${file} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it('外部の URL を読まない', () => {
    for (const file of files) {
      const text = readFileSync(file, 'utf8').replaceAll(SVG_XMLNS, '');
      expect(text, file).not.toMatch(/https?:\/\//);
      expect(text, file).not.toMatch(/url\(\s*['"]?\/\//);
      expect(text, file).not.toMatch(/@import\s+(url\()?['"]?(https?:)?\/\//);
    }
  });

  it('名前は仮称で、フッターの表記は決まった文', () => {
    expect(BRAND).toEqual({ name: 'Mado', provisional: true });
    expect(FOOTER_NOTICE).toBe('学習目的の非公式プロジェクトです。Meta 社とは関係ありません。');
  });
});
