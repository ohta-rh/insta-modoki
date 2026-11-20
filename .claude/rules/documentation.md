---
paths:
  - "docs/**"
  - "README.md"
  - "CLAUDE.md"
  - ".claude/**"
---

# Documentation — `docs/` is an OKF v0.3 bundle (ADR-0002)

Spec: Open Knowledge Format v0.3, `SPEC.md` of
https://github.com/open-knowledge-format/open-knowledge-format (checked 2026-11-20). The older
`GoogleCloudPlatform/open-knowledge-format` repository is deprecated (v0.2).

## Bundle rules

- `docs/` is the bundle root. `docs/index.md` carries the bundle frontmatter:
  `okf_version: "0.3"`, `title`, `description`. Keep it when regenerating the index.
- **A concept** = one `.md` file with YAML frontmatter that has a non-empty `type`. One concept
  per file; the path is its ID. Use `title` and `description` on every concept.
- **Types used here:** `ADR`, `Template`, `Proposal`, `Architecture`, `Guide`, `Research`,
  `Requirements`, `TestReport`. Add a new type only by listing it in `docs/index.md`.
- **Lifecycle** uses OKF `status`: `draft` (proposed), `stable` (accepted / current),
  `deprecated` (+ `superseded_by: <path>` when replaced). A moved concept leaves a deprecated
  stub at the old path.
- **Index files** (`index.md` in subdirectories) have **no frontmatter**; the body is headed
  sections of `* [Title](path) - description` entries.
- **Log files** (`docs/log.md`) have **no frontmatter**; `## YYYY-MM-DD` headings, newest first,
  entries like `* **Creation**: …`.
- Frontmatter: file starts with `---`; YAML 1.2 mapping; no duplicate keys; quote values that
  look like numbers, booleans or dates (`okf_version: "0.3"`).
- Links are standard Markdown links (no `[[wikilinks]]`), relative to the file or `/`-rooted at
  the bundle root. Non-`.md` files (PDF, images, HTML) are assets and may be linked.
- Every change under `docs/` adds an entry to `docs/log.md` and updates the directory's
  `index.md`.

## ADRs (`docs/adr/`)

- File `NNNN-kebab-title.md`, sequential, never renumbered. Copy `docs/adr/template.md`.
  When several workers may add ADRs at once, the Director assigns the numbers before dispatch.
- Frontmatter: `type: ADR`, `title`, `description`, `status`; body sections 背景 / 決定 /
  検討した選択肢 (table) / 結果, plus ステータス・日付・決定者 lines.
- Never edit an accepted ADR's decision. Supersede it: new ADR, old one gets
  `status: deprecated`, `superseded_by:` and its ステータス line updated.
- Add every ADR to `docs/adr/index.md` in the same commit.

## Language

Documents under `docs/` are Japanese. Harness files (`CLAUDE.md`, `.claude/**`) are English,
except literal output templates (issue headings) which stay Japanese.
