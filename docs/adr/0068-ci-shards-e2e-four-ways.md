---
type: ADR
title: "ADR-0068: CI の E2E は 4 つの job に分けて verify と同時に流す（ADR-0027 を一部置き換える）"
description: "CI は verify の job から e2e を外し（node scripts/verify.mjs --skip e2e）、e2e を shard 1〜4 の matrix の job で同時に流す。seed の project は最後の shard だけが流す。手元の verify は変えない。"
tags: [ci, testing, e2e]
status: stable
---

# ADR-0068: CI の E2E は 4 つの job に分けて verify と同時に流す（ADR-0027 を一部置き換える）

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。#119）
- 関連: [ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0027](0027-ci-runs-verify-and-docs-check.md)、[ADR-0059](0059-integration-tests-stay-within-a-quarter-of-their-timeout.md)
- 置き換え: ADR-0027 のうち「CI は 1 つの job で verify の全ての手順を流す」の部分（docs の検査・action の SHA 固定などは残る）

## 背景

- CI の実行 45131317749（2026-11-23）の verify の job は 15 分 6 秒で、そのうち `build` の後の E2E が 5 分 35 秒（290 件）だった。E2E は 1 台の runner の既定の worker 数で、他の手順と直列に走る。
- Playwright は `--shard <i>/<n>` でテストを分けられ、`seed` の project は chromium の後に走る決まりがある（`dependencies`）。

## 決定

- `.github/workflows/ci.yml` に `e2e` の job を足し、`matrix.shard: [1, 2, 3, 4]`、`fail-fast: false`、`timeout-minutes: 20` で流す。各 job は準備の後に `pnpm build` と `pnpm e2e --project chromium --shard <i>/4` を流す。
- `seed` の project は shard 4 だけが、続けて `pnpm e2e --project seed --no-deps` で 1 回流す。
- verify の job は `node scripts/verify.mjs --skip e2e` を流す。e2e 以外の手順は 1 つも減らさない。`verify.mjs` の `--skip <名前>` は何度でも指定でき、`--only` とは同時に使えない（2 で終わる）。存在しない名前は `verify: 不明な手順: <名前>` で 2。
- 手元の `node scripts/verify.mjs`（引数なし）は変えない。e2e を含む全ての手順が今のまま走る。
- 失敗した shard は `playwright-report-<i>` として HTML レポートを残す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| E2E を 4 つの shard の job に分ける（採用） | 最も遅い job が短くなる。verify と同時に走る | build が 4 回走る。必須の確認が 5 つに増える |
| worker 数を増やす | 設定が 1 行 | 4 コアの runner では CPU が足りず、時間切れが増える |
| 1 つの job のまま | 変更なし | E2E の件数が増えるほど job が延びる |
| build を 1 つの job で行い成果物を共有する | build が 1 回で済む | artifact の受け渡しで job が 1 つ増え、待ちが直列になる |

## 結果

- push ごとの待ちは、最も遅い job の所要時間になる。実測は #119 のコメントに残す。
- branch protection の必須の確認は、`verify` と `e2e (1/4)`〜`e2e (4/4)` の 5 つになる。設定は利用者が行う。
- ADR-0027 の「CI は手元と同じ verify を流す」は、「CI は同じ手順を、E2E だけ分けて流す」になる。
- shard の数（4）は ci.yml と、それを確かめる `scripts/ci-workflow.test.ts` の両方に書く。
