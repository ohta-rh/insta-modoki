import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Reads the slices' entry files and follows their `export … from './…'` chain (ADR-0014, ADR-0057).
// No DOM, no database: files are only read.
const FEATURES = resolve(__dirname, '../features');

const sliceNames = readdirSync(FEATURES).filter((name) =>
  statSync(join(FEATURES, name)).isDirectory(),
);

function resolveModule(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec);
  for (const candidate of [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, 'index.ts'),
    join(base, 'index.tsx'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function stripLeadingComments(source: string): string {
  return source.replace(/^(\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, '');
}

function hasDirective(source: string, directive: string): boolean {
  const head = stripLeadingComments(source);
  return head.startsWith(`'${directive}'`) || head.startsWith(`"${directive}"`);
}

/** Every file reachable from `entry` through re-exports (the entry itself excluded). */
function exportedFiles(entry: string): string[] {
  const seen = new Set<string>();
  const walk = (file: string) => {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/export\s[^;]*?from\s+['"](\.[^'"]*)['"]/g)) {
      const target = resolveModule(file, match[1] as string);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      walk(target);
    }
  };
  walk(entry);
  return [...seen];
}

describe('slice の入口', () => {
  it('slice の入口はクライアントの部品を公開しない', () => {
    const violations: string[] = [];
    for (const slice of sliceNames) {
      const entry = join(FEATURES, slice, 'index.ts');
      if (!existsSync(entry)) continue;
      for (const file of exportedFiles(entry)) {
        if (hasDirective(readFileSync(file, 'utf8'), 'use client')) {
          violations.push(
            `${slice}/index.ts が ${relative(join(FEATURES, slice), file)} を公開しています。画面の部品は ${slice}/ui/index.ts から公開します`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('slice の ui/index.ts はサーバー専用の処理を公開しない', () => {
    const violations: string[] = [];
    for (const slice of sliceNames) {
      const entry = join(FEATURES, slice, 'ui', 'index.ts');
      if (!existsSync(entry)) continue;
      for (const file of exportedFiles(entry)) {
        const source = readFileSync(file, 'utf8');
        if (
          hasDirective(source, 'use server') ||
          /^\s*import\s+['"]server-only['"]/m.test(source)
        ) {
          violations.push(
            `${slice}/ui/index.ts が ${relative(join(FEATURES, slice), file)} を公開しています。サーバー専用の処理は ${slice}/index.ts から公開します`,
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
