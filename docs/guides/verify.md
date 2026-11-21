---
type: Guide
title: verify の流し方
description: PBI の完了を判定する verify コマンドの手順・順番・終了コード、1 手順だけ流す方法、スロットのポートの渡し方。コードを変えたら最後に流す。
tags: [verify, testing]
status: stable
---

# verify の流し方

`pnpm verify`（中身は `node scripts/verify.mjs`）が、型検査から E2E までを下の順に流す（CI も同じコマンドを流す。「CI」の節）。1 つでも失敗したらそこで止める。PBI の「完了」は、`main` への rebase の後に verify が 0 で終わること（[ADR-0009](../adr/0009-tdd-review-e2e-verify-loop.md)、[ADR-0024](../adr/0024-verify-command-and-coverage-gate.md)）。

## 手順

手順は `scripts/verify.mjs` の `STEPS` が持ち、この表と同じ順・同じコマンドでなければならない（`scripts/verify.test.ts` が突き合わせる）。

| 名前 | コマンド | 失敗の意味 |
|---|---|---|
| `typecheck` | `pnpm typecheck` | TypeScript の型の誤り |
| `lint` | `pnpm lint` | ESLint の違反 |
| `format` | `pnpm format:check` | Prettier の形式に合っていないファイルがある |
| `docs` | `node scripts/check-docs.mjs docs` | `docs/` が OKF v0.3 の規則（下の「docs の検査」）に合っていない |
| `unit` | `pnpm exec vitest run --coverage --exclude "**/*.int.test.ts"` | 単体テストの失敗、または `src/**/model/**` と `src/shared/config/**` の行カバレッジが 80% 未満 |
| `integration` | `pnpm exec vitest run --passWithNoTests .int.test.ts` | 結合テストの失敗（`src/`・`scripts/`・`tests/` の `*.int.test.ts` が 1 つも無いときは `integration: テストなし` を出して成功） |
| `build` | `pnpm build` | OpenNext のビルドの失敗 |
| `e2e` | `pnpm e2e` | Playwright の失敗（ビルドの成果物を `pnpm start` で workerd に載せて開く） |

## 使い方

- 全部流す: `node scripts/verify.mjs`
- 手順の一覧: `node scripts/verify.mjs --list`
- 1 手順だけ流す: `node scripts/verify.mjs --only unit`
- スロットのポートを渡す: `PORT=3101 node scripts/verify.mjs`（E2E の `webServer` と `start` がこのポートを使う。未設定は 3100。スロット N は `3100 + N`）

`e2e` は `build` の成果物を使うので、単独で流す前に `pnpm build` が要る。Chromium は初回に `pnpm exec playwright install chromium` で入れる。

## docs の検査

`node scripts/check-docs.mjs [<root>]`（既定は `docs`）が [`.claude/rules/documentation.md`](../../.claude/rules/documentation.md) の規則を検査する（[ADR-0027](../adr/0027-ci-runs-verify-and-docs-check.md)）。エラーは 1 行ずつ `<root からの相対パス>: <メッセージ>`、最後に `check-docs: <n> 件のエラー`（終了コード 1）。全て通れば `check-docs: OK (<n> 件の文書)`（0）。

- コンセプトの文書に `type`・`title`・`description` があり、`type` が `docs/index.md` の「type の一覧」にある（`missing type` / `missing title` / `missing description` / `unknown type <名前>`）
- サブディレクトリの `index.md` と `log.md` に frontmatter が無い（`reserved file must not have frontmatter`）
- ルートの `index.md` の `okf_version` が文字列 `"0.3"`（`okf_version != "0.3"`）
- frontmatter が閉じている（`unterminated frontmatter`）、トップレベルのキーが重複しない（`duplicate key <キー>`）、値が空のキーが無い（`empty value for <キー>`。次の行が字下げの塊なら除く）
- 相対と `/` 始まりのリンク先が存在する（`broken link <リンク>`。`https:` などの外部のリンクと `#` だけのリンクは見ない）、wikilink が無い（`wikilink`）。コードブロックとインラインコードの中は見ない

依存を足さないため、トップレベルの `key:` の行だけを読む。入れ子の YAML の文法の誤りは検出しない。

## CI

`.github/workflows/ci.yml` の job `verify` が、`main` への push と pull request で動く。`docker compose up -d --wait`（Garage だけ）→ `node scripts/slot.mjs prepare 0` → `pnpm exec playwright install --with-deps chromium` → `PORT=3100 SLOT_INT=1 node scripts/verify.mjs` を流し、失敗したら `playwright-report` を残す。使う action は 40 桁の commit SHA で固定する（[ADR-0027](../adr/0027-ci-runs-verify-and-docs-check.md)）。

## 出力と終了コード

手順ごとに `verify: <名前> ...` と `verify: <名前> OK` を出し、失敗したら `verify: FAIL <名前>`、全て成功したら最後の行が `verify: OK`。

| 終了コード | 意味 |
|---|---|
| 0 | 全て成功 |
| 失敗した手順のコマンドの終了コード（0 や不明のときは 1） | その手順の失敗。後の手順は流さない |
| 2 | 引数の誤り（存在しない手順は `verify: 不明な手順: <名前>`） |

## 手順を足す

後の PBI は `STEPS` に 1 行足し、この表にも同じ行を足す。
