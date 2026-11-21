---
type: Guide
title: verify の流し方
description: PBI の完了を判定する verify コマンドの手順・順番・終了コード、1 手順だけ流す方法、スロットのポートの渡し方。コードを変えたら最後に流す。
tags: [verify, testing]
status: stable
---

# verify の流し方

`pnpm verify`（中身は `node scripts/verify.mjs`）が、型検査から E2E までを下の順に流す。1 つでも失敗したらそこで止める。PBI の「完了」は、`main` への rebase の後に verify が 0 で終わること（[ADR-0009](../adr/0009-tdd-review-e2e-verify-loop.md)、[ADR-0024](../adr/0024-verify-command-and-coverage-gate.md)）。

## 手順

手順は `scripts/verify.mjs` の `STEPS` が持ち、この表と同じ順・同じコマンドでなければならない（`scripts/verify.test.ts` が突き合わせる）。

| 名前 | コマンド | 失敗の意味 |
|---|---|---|
| `typecheck` | `pnpm typecheck` | TypeScript の型の誤り |
| `lint` | `pnpm lint` | ESLint の違反 |
| `format` | `pnpm format:check` | Prettier の形式に合っていないファイルがある |
| `unit` | `pnpm exec vitest run --coverage --exclude "**/*.int.test.ts"` | 単体テストの失敗、または `src/**/model/**` と `src/shared/config/**` の行カバレッジが 80% 未満 |
| `integration` | `pnpm exec vitest run --passWithNoTests .int.test.ts` | 結合テストの失敗（`src/**/*.int.test.ts` が 1 つも無いときは `integration: テストなし` を出して成功） |
| `build` | `pnpm build` | OpenNext のビルドの失敗 |
| `e2e` | `pnpm e2e` | Playwright の失敗（ビルドの成果物を `pnpm start` で workerd に載せて開く） |

## 使い方

- 全部流す: `node scripts/verify.mjs`
- 手順の一覧: `node scripts/verify.mjs --list`
- 1 手順だけ流す: `node scripts/verify.mjs --only unit`
- スロットのポートを渡す: `PORT=3101 node scripts/verify.mjs`（E2E の `webServer` と `start` がこのポートを使う。未設定は 3100。スロット N は `3100 + N`）

`e2e` は `build` の成果物を使うので、単独で流す前に `pnpm build` が要る。Chromium は初回に `pnpm exec playwright install chromium` で入れる。

## 出力と終了コード

手順ごとに `verify: <名前> ...` と `verify: <名前> OK` を出し、失敗したら `verify: FAIL <名前>`、全て成功したら最後の行が `verify: OK`。

| 終了コード | 意味 |
|---|---|
| 0 | 全て成功 |
| 失敗した手順のコマンドの終了コード（0 や不明のときは 1） | その手順の失敗。後の手順は流さない |
| 2 | 引数の誤り（存在しない手順は `verify: 不明な手順: <名前>`） |

## 手順を足す

後の PBI（CI の docs の検査など）は `STEPS` に 1 行足し、この表にも同じ行を足す。
