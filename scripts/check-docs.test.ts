import { afterEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { main } from './check-docs.mjs';

const rootIndex = `---
okf_version: "0.3"
title: テスト
description: テスト用のバンドル
---

# テスト

# type の一覧

* \`Guide\` - 手順
* \`ADR\` - 決定
`;

const concept = (extra = '') =>
  `---\ntype: Guide\ntitle: 手順\ndescription: 手順の説明\n${extra}---\n\n# 手順\n`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** Writes a docs tree (a valid root index.md plus `files`) and runs the checker on it. */
function run(
  files: Record<string, string>,
  base: Record<string, string> = { 'index.md': rootIndex },
) {
  const root = mkdtempSync(join(tmpdir(), 'check-docs-'));
  dirs.push(root);
  for (const [path, text] of Object.entries({ ...base, ...files })) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  const lines: string[] = [];
  const code = main([root], { log: (l: string) => lines.push(l) });
  return { code, lines };
}

describe('check-docs', () => {
  it('規則を満たす文書は OK を返す', () => {
    const { code, lines } = run({
      'a.md': concept(),
      'sub/index.md': '# 一覧\n\n* [a](../a.md) - a\n',
      'log.md': '## 2026-11-21\n* **Creation**: a\n',
    });
    expect(lines).toEqual(['check-docs: OK (4 件の文書)']);
    expect(code).toBe(0);
  });

  function expectError(files: Record<string, string>, line: string) {
    const { code, lines } = run(files);
    expect(lines).toEqual([line, 'check-docs: 1 件のエラー']);
    expect(code).toBe(1);
  }

  it('type が無い文書は missing type を返す', () => {
    expectError({ 'a.md': '---\ntitle: a\ndescription: b\n---\n' }, 'a.md: missing type');
  });

  it('title が空の文書は missing title を返す', () => {
    expectError(
      { 'a.md': '---\ntype: Guide\ntitle:\ndescription: b\n---\n' },
      'a.md: missing title',
    );
  });

  it('description が無い文書は missing description を返す', () => {
    expectError({ 'a.md': '---\ntype: Guide\ntitle: a\n---\n' }, 'a.md: missing description');
  });

  it('サブディレクトリの index.md に frontmatter があると reserved file must not have frontmatter を返す', () => {
    expectError(
      { 'sub/index.md': concept() },
      'sub/index.md: reserved file must not have frontmatter',
    );
  });

  it('log.md に frontmatter があると同じエラーを返す', () => {
    expectError({ 'log.md': concept() }, 'log.md: reserved file must not have frontmatter');
  });

  it('ルートの index.md の okf_version が 0.3 でない（数値の 0.3 を含む）と okf_version != "0.3" を返す', () => {
    for (const v of ['0.3', '"0.2"', '']) {
      const index = rootIndex.replace('okf_version: "0.3"', `okf_version: ${v}`);
      const { code, lines } = run({}, { 'index.md': index });
      expect(lines[0]).toMatch(/^index\.md: (okf_version != "0\.3"|empty value for okf_version)$/);
      expect(code).toBe(1);
    }
    const numeric = run({}, { 'index.md': rootIndex.replace('"0.3"', '0.3') });
    expect(numeric.lines[0]).toBe('index.md: okf_version != "0.3"');
    const missing = run({}, { 'index.md': '# 本文だけ\n' });
    expect(missing.lines).toContain('index.md: okf_version != "0.3"');
  });

  it('存在しないファイルへのリンクは broken link を返す（相対と / 始まりの両方）', () => {
    const { code, lines } = run({
      'sub/a.md':
        concept('') + '\n[x](nope.md) [y](/missing/b.md) [ok](../index.md) [ok2](/index.md)\n',
    });
    expect(lines).toEqual([
      'sub/a.md: broken link nope.md',
      'sub/a.md: broken link /missing/b.md',
      'check-docs: 2 件のエラー',
    ]);
    expect(code).toBe(1);
  });

  it('wikilink は wikilink を返す', () => {
    expectError({ 'a.md': concept() + '\n[[other]] を見る\n' }, 'a.md: wikilink');
  });

  it('frontmatter が閉じていないと unterminated frontmatter を返す', () => {
    expectError(
      { 'a.md': '---\ntype: Guide\ntitle: a\ndescription: b\n\n本文\n' },
      'a.md: unterminated frontmatter',
    );
  });

  it('同じキーが 2 回あると duplicate key を返す', () => {
    expectError({ 'a.md': concept('title: もう一度\n') }, 'a.md: duplicate key title');
  });

  it('値が空のキーはエラーにし、次の行が字下げの塊なら除く', () => {
    expectError({ 'a.md': concept('status:\n') }, 'a.md: empty value for status');
    const ok = run({ 'a.md': concept('tags:\n  - x\n  - y\nrefs:\n- z\n') });
    expect(ok.code).toBe(0);
  });

  it('type の一覧に無い type は unknown type を返す', () => {
    expectError(
      { 'a.md': '---\ntype: Mystery\ntitle: a\ndescription: b\n---\n' },
      'a.md: unknown type Mystery',
    );
  });

  it('https のリンクとページ内のリンクは検査しない', () => {
    const { code, lines } = run({
      'a.md':
        concept() + '\n[w](https://example.com/x) [h](#top) [m](mailto:a@b.c) [f](b.md#sec)\n',
      'b.md': concept(),
    });
    expect(lines).toEqual(['check-docs: OK (3 件の文書)']);
    expect(code).toBe(0);
  });

  it('コードブロックとインラインコードの中のリンクと wikilink は検査しない', () => {
    const body = '\n```\n[[x]] [a](nope.md)\n```\n`[[y]]` `[b](nope2.md)`\n';
    expect(run({ 'a.md': concept() + body }).code).toBe(0);
  });

  it('ルートが無いと 2 を返す', () => {
    const lines: string[] = [];
    const code = main(['/nonexistent-check-docs-root'], { log: (l: string) => lines.push(l) });
    expect(code).toBe(2);
    expect(lines[0]).toContain('check-docs:');
  });

  it('type の一覧が無いルートの index.md はエラーにする', () => {
    const { code, lines } = run({}, { 'index.md': rootIndex.split('# type の一覧')[0] });
    expect(lines[0]).toBe('index.md: type list not found');
    expect(code).toBe(1);
  });

  it('このリポジトリの docs/ は規則を満たす', () => {
    const lines: string[] = [];
    const code = main([join(import.meta.dirname, '..', 'docs')], {
      log: (l: string) => lines.push(l),
    });
    expect(lines.at(-1)).toMatch(/^check-docs: OK \(\d+ 件の文書\)$/);
    expect(code).toBe(0);
  });
});
