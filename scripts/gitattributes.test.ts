import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const git = (cwd: string, ...args: string[]): string =>
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args],
    { cwd, encoding: 'utf8' },
  );

const mergeAttr = (cwd: string, path: string): string =>
  git(cwd, 'check-attr', 'merge', '--', path).trim();

describe('.gitattributes', () => {
  it('docs/log.md merges as union', () => {
    expect(mergeAttr(root, 'docs/log.md')).toBe('docs/log.md: merge: union');
  });

  it('two appends under the same date heading rebase without conflict', () => {
    const dir = mkdtempSync(join(tmpdir(), 'gitattributes-'));
    try {
      git(dir, 'init', '-q', '-b', 'main');
      mkdirSync(join(dir, 'docs'));
      writeFileSync(join(dir, '.gitattributes'), readFileSync(join(root, '.gitattributes')));
      writeFileSync(join(dir, 'docs/log.md'), '# log\n\n## 2026-11-23\n* base line\n');
      git(dir, 'add', '.gitattributes', 'docs/log.md');
      git(dir, 'commit', '-q', '-m', 'base');

      const append = (branch: string, line: string): void => {
        git(dir, 'checkout', '-q', '-b', branch, 'main');
        writeFileSync(
          join(dir, 'docs/log.md'),
          `# log\n\n## 2026-11-23\n${line}\n* base line\n`,
        );
        git(dir, 'add', 'docs/log.md');
        git(dir, 'commit', '-q', '-m', branch);
      };
      append('a', '* line from a (#1)');
      append('b', '* line from b (#2)');

      git(dir, 'rebase', 'a');
      const log = readFileSync(join(dir, 'docs/log.md'), 'utf8');
      expect(log).toContain('* line from a (#1)');
      expect(log).toContain('* line from b (#2)');
      expect(log).toContain('* base line');
      expect(log).not.toContain('<<<<<<<');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('no other file merges as union', () => {
    for (const path of ['docs/adr/index.md', 'docs/index.md', 'src/shared/db/schema.ts', 'package.json']) {
      expect(mergeAttr(root, path)).toBe(`${path}: merge: unspecified`);
    }
  });
});
