import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('../..', import.meta.url).pathname.replace(/\/$/, ''); // src (this file is src/shared/ui/)
const ROOT = join(SRC, '..');

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...tsxFiles(path));
    else if (name.endsWith('.tsx')) out.push(path);
  }
  return out;
}

/**
 * Every quoted string literal ("…", '…', `…`) with the line it starts on. Each quote kind is
 * scanned on its own so an apostrophe in a comment cannot shift the pairing of the others.
 */
function* literals(source: string): Generator<{ text: string; line: number }> {
  for (const re of [/"([^"\n]*)"/g, /'([^'\n]*)'/g, /`([^`]*)`/g]) {
    for (const m of source.matchAll(re)) {
      const line = source.slice(0, m.index).split('\n').length;
      yield { text: m[1], line };
    }
  }
}

const has = (classes: string[], name: string) => classes.includes(name);

describe('色の使い方', () => {
  it('補助の文字を面の上に置くクラスの組が無い', () => {
    const violations: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const source = readFileSync(file, 'utf8');
      const rel = file.slice(ROOT.length + 1);
      for (const { text, line } of literals(source)) {
        if (!text.includes('text-text-secondary') && !text.includes('hover:bg-')) continue;
        const classes = text.split(/\s+/).filter(Boolean);
        for (const surface of ['bg-surface', 'bg-highlight']) {
          if (has(classes, surface) && has(classes, 'text-text-secondary')) {
            violations.push(
              `${rel}:${line} 補助の文字（text-text-secondary）を面（${surface}）の上に置いています`,
            );
          }
        }
        for (const surface of ['hover:bg-surface', 'hover:bg-highlight']) {
          if (
            has(classes, surface) &&
            has(classes, 'text-text-secondary') &&
            !has(classes, 'hover:text-text')
          ) {
            violations.push(
              `${rel}:${line} ${surface} の要素の補助の文字（text-text-secondary）に hover:text-text がありません`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('エラーの赤（text-danger）を面の上に置くクラスの組が無い（surface の上で 4.47:1）', () => {
    const violations: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const rel = file.slice(ROOT.length + 1);
      for (const { text, line } of literals(readFileSync(file, 'utf8'))) {
        const classes = text.split(/\s+/).filter(Boolean);
        if (!has(classes, 'text-danger')) continue;
        for (const surface of [
          'bg-surface',
          'bg-highlight',
          'hover:bg-surface',
          'hover:bg-highlight',
        ]) {
          if (has(classes, surface)) {
            violations.push(
              `${rel}:${line} text-danger を ${surface} の上に置いています（hover:bg-wash を使う）`,
            );
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('Tailwind の red-* の文字・枠の色を、ログインと登録の 2 つ（#96 で置き換える）の外で使わない', () => {
    const ALLOWED = ['features/auth/ui/LogInForm.tsx', 'features/auth/ui/SignUpForm.tsx'];
    const violations: string[] = [];
    for (const file of tsxFiles(SRC)) {
      const rel = file.slice(ROOT.length + 1);
      if (ALLOWED.some((a) => rel.endsWith(a))) continue;
      for (const { text, line } of literals(readFileSync(file, 'utf8'))) {
        const m = text.match(/(?:^|[\s:])((?:text|border|bg)-red-\d+)\b/);
        if (m)
          violations.push(
            `${rel}:${line} ${m[1]} は text-danger / border-danger / text-like にします`,
          );
      }
    }
    expect(violations).toEqual([]);
  });
});
