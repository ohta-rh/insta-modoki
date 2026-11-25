---
type: ADR
title: "ADR-0027: CI は GitHub Actions の 1 つの job で verify を流し、docs の検査は依存の無い scripts/check-docs.mjs を verify の手順にする"
description: "main への push と pull request で verify 全体（docs の検査を含む）を 1 job で流す。docs の検査は Node の標準だけで書き、トップレベルの frontmatter だけを読む。action は commit SHA で固定する。"
tags: [ci, testing, docs]
status: stable
---

# ADR-0027: CI は GitHub Actions の 1 つの job で verify を流し、docs の検査は依存の無い scripts/check-docs.mjs を verify の手順にする

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #22、[ADR-0002](0002-docs-as-okf-v0-3-bundle.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0022](0022-testing-ui-and-package-management.md)、[ADR-0023](0023-slots-with-garage-and-d1-files.md)、[ADR-0024](0024-verify-command-and-coverage-gate.md)

## 背景

OKF の検査は手元の使い捨てのスクリプトにしか無く、リポジトリに CI が無かった。ローカルの緑だけでは、検査を飛ばした変更が `main` に入るのを防げない。ADR-0002 は「同じ間違いが 2 回起きたら検査スクリプトにして verify に入れる」とした。`package.json` と lockfile は同じ Wave の別の PBI（#24）が触るので、この PBI は依存を足せない。

## 決定

- docs の検査は `scripts/check-docs.mjs`（Node の標準だけ）。`.claude/rules/documentation.md` の規則と、`type` が `docs/index.md` の「type の一覧」にあることを検査する。YAML は読まず、トップレベルの `key:` の行だけを見る。入れ子の YAML の文法の誤りは検出しない。
- verify の手順 `docs`（`node scripts/check-docs.mjs docs`）を `format` の次に足す（[ADR-0024](0024-verify-command-and-coverage-gate.md) の 7 つの手順は 8 つになる。ADR-0024 の決定の形は変えない）。
- CI は `.github/workflows/ci.yml` の 1 つの job `verify`。`main` への push と pull request で動き、`permissions` は `contents: read` だけ、`timeout-minutes: 20`、同じ ref の古い実行は取り消す。
- 手順: checkout → `pnpm/action-setup`（`packageManager` の版）→ `actions/setup-node`（`.node-version`、`cache: pnpm`）→ `pnpm install --frozen-lockfile` → `docker compose up -d --wait`（Garage だけ）→ `node scripts/slot.mjs prepare 0` → `pnpm exec playwright install --with-deps chromium` → `PORT=3100 SLOT_INT=1 node scripts/verify.mjs`。CI は使い捨ての環境なのでスロットの結合テスト（`SLOT_INT=1`）もここで流す。結合テストが捨てるスロットは `SLOT_INT_A=3`・`SLOT_INT_B=4` にして、CI が使うスロット 0 のバケットを消さない。checkout は `persist-credentials: false`（後の手順に token を残さない）。
- 失敗したとき `playwright-report` を upload する。そのため `playwright.config.ts` は `CI` があるとき HTML のレポートも出す。
- 使う action は 40 桁の commit SHA で固定する（行末のコメントに版）。`scripts/ci-workflow.test.ts` が行の正規表現で確かめる（YAML の依存を足さない）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 依存の無い自前の検査（採用） | `package.json` を触らない。規則がリポジトリの中にあり、テストできる | 入れ子の YAML の誤りは見ない。YAML のパーサを使えば見られる |
| YAML のライブラリを入れる | frontmatter を正確に読める | #24 と `package.json` / lockfile が衝突する。依存が増える |
| 手元の Ruby の検査を CI に流す | 書き直さなくてよい | CI に Ruby と YAML の環境が要り、リポジトリの外の道具に頼る |
| job を typecheck / test / e2e に分ける | 並列で速い | install・build・E2E の準備を job ごとに繰り返し、ローカルの verify と形が違う |
| action をタグで指す | 更新が楽 | タグは付け替えられ、サプライチェーンの攻撃面になる |

## 結果

- `main` に入る変更は、verify と docs の検査を通る。ローカルと CI が同じコマンド（`node scripts/verify.mjs`）を流す。
- 受け入れるコスト: 入れ子の YAML の誤りは検出しない。action の更新は SHA と版のコメントを手で変える。CI の時間は build と E2E を含む。
- 守ること: 検査の規則を変えるときは `.claude/rules/documentation.md`、`scripts/check-docs.mjs`、`docs/guides/verify.md` を同じ commit で変える。`permissions` を増やさない。action はタグで指さない。
