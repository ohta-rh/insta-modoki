---
type: ADR
title: "ADR-0024: verify は scripts/verify.mjs が 7 つの手順を固定の順に流し、単体テストの行カバレッジ 80% を基準にする"
description: "verify は typecheck・lint・format・unit・integration・build・e2e を順に流して最初の失敗で止める Node.js のスクリプト。カバレッジは src/**/model/** と src/shared/config/** の行 80%。単体テストには scripts/**/*.test.ts も含める。"
tags: [testing, verify, tooling]
status: stable
---

# ADR-0024: verify は scripts/verify.mjs が 7 つの手順を固定の順に流し、単体テストの行カバレッジ 80% を基準にする

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #19、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0014](0014-code-in-feature-slices.md)、[ADR-0022](0022-testing-ui-and-package-management.md)

## 背景

ADR-0009 は「完了 = verify が 0 で終わる」とし、中身は最初の基盤の PBI で決めるとした。決まっていないと、PBI ごとに緑の意味が変わる。企画書は成功指標に「ドメインロジックの行カバレッジ 80% 以上」を置く。後の PBI（CI の docs の検査など）が手順を足せる形が要る。

## 決定

- verify は `scripts/verify.mjs`（`pnpm verify` が呼ぶ）。`STEPS = [{ name, command }]` を export し、`typecheck`・`lint`・`format`・`unit`・`integration`・`build`・`e2e` をこの順に流し、最初の失敗で止める。手順の追加は配列に足すだけ。表は `docs/guides/verify.md` に置き、テストで一覧と突き合わせる。
- 終了コード: 成功 0、失敗は失敗した手順のコマンドの終了コード（0 や不明なら 1）、引数の誤りは 2。
- 単体テストは `src/**/*.test.ts(x)` と `scripts/**/*.test.ts`（`*.int.test.ts` を除く）。結合テストは `src/**/*.int.test.ts` で、1 つも無ければ `integration: テストなし` を出して成功にする。
- カバレッジは Vitest の v8 で測り、対象を `src/**/model/**` と `src/shared/config/**`、基準を行 80% にする。基準は `scripts/verify.mjs` の `COVERAGE_LINES` を `vitest.config.ts` の `thresholds` が読み、下回ると `unit` が失敗する。
- Playwright は Chromium だけ、`webServer` は `pnpm start`（ビルドの成果物を workerd で）を `PORT` で起動し、`reuseExistingServer: false`。
- `postcss.config.mjs` と Tailwind は #24 が足す（この PBI では CSS を使わない）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Node.js のスクリプト（採用） | 追加の依存が無い。手順を配列で export でき、テストできる。`--only` と `--list` が書ける | 自前の保守 |
| package.json の scripts を `&&` でつなぐ | ファイルが要らない | 失敗した手順の名前が出ない。一覧と突き合わせられない |
| Turborepo / npm-run-all | 並列・キャッシュ | 依存が増え、順番に止める単純な要件には過剰 |
| カバレッジをアプリ全体に掛ける | 数字が大きく見える | UI や配線は E2E で見る。ドメインロジックの基準（企画書）とずれる |

## 結果

- どの PBI も同じ基準で完了を判定でき、失敗した手順の名前が出る。
- 受け入れるコスト: verify は build と E2E を含むので遅い。途中の確認は `--only` で行う。
- 守ること: 手順を足すときは `STEPS` と `docs/guides/verify.md` の表を同じ commit で変える。カバレッジの対象からファイルを外して基準を満たさない。
