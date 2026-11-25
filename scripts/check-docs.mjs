// check-docs: checks that a docs/ directory is an OKF v0.3 bundle (ADR-0002, ADR-0027).
// Rules: .claude/rules/documentation.md "Bundle rules". Dependency-free on purpose: it reads
// only the top-level `key:` lines of the frontmatter, so a syntax error inside a nested YAML
// value is NOT detected (documented in docs/guides/verify.md).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_KEYS = ['title', 'description'];

/** Lists every `.md` file under `dir`, sorted, as paths relative to `root`. */
function listMarkdown(root, dir = root) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listMarkdown(root, path));
    else if (entry.name.endsWith('.md')) found.push(relative(root, path).split(sep).join('/'));
  }
  return found.sort();
}

/**
 * Splits a file into its frontmatter and body.
 * Returns `{ fm: null }` without frontmatter, `{ unterminated: true }` when it never closes.
 */
function splitFrontmatter(text) {
  if (!text.startsWith('---\n')) return { fm: null, body: text };
  const lines = text.slice(4).split('\n');
  const end = lines.indexOf('---');
  if (end === -1) return { unterminated: true, body: '' };
  return { fm: lines.slice(0, end), body: lines.slice(end + 1).join('\n') };
}

/** Reads top-level `key: value` lines. Returns the entries and the keys seen twice. */
function parseTopLevel(fmLines) {
  const entries = [];
  const duplicates = [];
  const seen = new Set();
  fmLines.forEach((line, i) => {
    const m = line.match(/^([A-Za-z0-9_][A-Za-z0-9_-]*):(?:\s+(.*?))?\s*$/);
    if (!m) return;
    const next = fmLines[i + 1] ?? '';
    const hasBlock = /^(\s+\S|-\s)/.test(next);
    if (seen.has(m[1])) duplicates.push(m[1]);
    else {
      seen.add(m[1]);
      entries.push({ key: m[1], value: (m[2] ?? '').trim(), hasBlock });
    }
  });
  return { entries, duplicates };
}

const unquote = (v) => v.replace(/^(["'])(.*)\1$/, '$2');

/** Allowed types: the bullets of the "# type の一覧" section of the root index.md. */
function readTypeList(indexText) {
  const start = indexText.indexOf('# type の一覧');
  if (start === -1) return null;
  const types = [];
  for (const line of indexText.slice(start).split('\n').slice(1)) {
    if (/^#\s/.test(line)) break;
    const m = line.match(/^\*\s+`([^`]+)`/);
    if (m) types.push(m[1]);
  }
  return types.length > 0 ? types : null;
}

/** Drops fenced code blocks and inline code so examples are not checked as links. */
const stripCode = (body) =>
  body.replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, '').replace(/`[^`\n]*`/g, '');

function checkLinks(root, file, body, errors) {
  for (const m of body.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#')) continue;
    let path = target.split(/[#?]/)[0];
    try {
      path = decodeURIComponent(path);
    } catch {
      // keep the raw path
    }
    const resolved = path.startsWith('/')
      ? join(root, path.slice(1))
      : resolve(root, dirname(file), path);
    if (!existsSync(resolved)) errors.push(`${file}: broken link ${target}`);
  }
}

/** Checks the bundle at `root`. Returns `{ errors, count }` (count = number of documents). */
export function checkDocs(root) {
  const errors = [];
  const files = listMarkdown(root);
  const indexPath = join(root, 'index.md');
  const types = existsSync(indexPath) ? readTypeList(readFileSync(indexPath, 'utf8')) : null;
  if (existsSync(indexPath) && types === null) errors.push('index.md: type list not found');

  for (const file of files) {
    const text = readFileSync(join(root, file), 'utf8').replace(/\r\n/g, '\n');
    const split = splitFrontmatter(text);
    if (split.unterminated) {
      errors.push(`${file}: unterminated frontmatter`);
      continue;
    }
    const { entries, duplicates } = split.fm
      ? parseTopLevel(split.fm)
      : { entries: [], duplicates: [] };
    const value = (key) => entries.find((e) => e.key === key);
    for (const key of duplicates) errors.push(`${file}: duplicate key ${key}`);

    const name = basename(file);
    const required = new Set();
    if (name === 'log.md' || (name === 'index.md' && file !== 'index.md')) {
      if (split.fm) errors.push(`${file}: reserved file must not have frontmatter`);
    } else if (file === 'index.md') {
      const v = value('okf_version');
      if (!v || (v.value !== '"0.3"' && v.value !== "'0.3'"))
        errors.push('index.md: okf_version != "0.3"');
      required.add('okf_version');
    } else {
      const type = value('type');
      const typeName = type ? unquote(type.value) : '';
      if (typeName === '') errors.push(`${file}: missing type`);
      else if (types !== null && !types.includes(typeName)) {
        errors.push(`${file}: unknown type ${typeName}`);
      }
      required.add('type');
      for (const key of REQUIRED_KEYS) {
        const v = value(key);
        if (!v || (unquote(v.value) === '' && !v.hasBlock)) errors.push(`${file}: missing ${key}`);
        required.add(key);
      }
    }
    for (const e of entries) {
      if (!required.has(e.key) && e.value === '' && !e.hasBlock) {
        errors.push(`${file}: empty value for ${e.key}`);
      }
    }

    const body = stripCode(split.body);
    checkLinks(root, file, body, errors);
    if (/\[\[[^\]\n]+\]\]/.test(body)) errors.push(`${file}: wikilink`);
  }
  return { errors, count: files.length };
}

const defaultDeps = { log: (line) => console.log(line) };

/** Returns the process exit code: 0 ok, 1 rule violations, 2 root is not a directory. */
export function main(argv, deps = defaultDeps) {
  const { log } = { ...defaultDeps, ...deps };
  const root = resolve(argv[0] ?? 'docs');
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    log(`check-docs: ディレクトリが無い: ${root}`);
    return 2;
  }
  const { errors, count } = checkDocs(root);
  for (const line of errors) log(line);
  if (errors.length > 0) {
    log(`check-docs: ${errors.length} 件のエラー`);
    return 1;
  }
  log(`check-docs: OK (${count} 件の文書)`);
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
