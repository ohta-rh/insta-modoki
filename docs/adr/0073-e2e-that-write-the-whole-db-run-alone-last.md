---
type: ADR
title: "ADR-0073: DB の全体に書き込む E2E は、exclusive の project で最後に単独で走らせる"
description: "*.exclusive.spec.ts は playwright.config.ts の exclusive project だけが読み、chromium と seed の後に 1 人で走る。CI は shard 4 が seed の後に流す。"
tags: [testing, e2e]
status: stable
---

# ADR-0073: DB の全体に書き込む E2E は、exclusive の project で最後に単独で走らせる

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。#131）
- 関連: [ADR-0068](0068-ci-shards-e2e-four-ways.md)

## 背景

- `e2e/visual-home-aside.spec.ts` の「候補がいなければおすすめの見出しを出さない」は、おすすめの候補を 0 にするため、DB の全員を `INSERT OR IGNORE INTO follows … FROM users` でフォローする。
- `playwright.config.ts` は `fullyParallel: true` で、同じスロットの DB を複数の worker が同時に使う。同時に作られた利用者もフォローされ、`e2e/follow.spec.ts` の `Expected: "1 フォロワー"` が `"2 フォロワー"` になって落ちた（2026-11-24、`340dff7` の verify）。

## 決定

- DB の全体（ほかの worker が作った行）に書き込む E2E は `*.exclusive.spec.ts` に書く。
- `playwright.config.ts` に project `exclusive`（`testMatch: '**/*.exclusive.spec.ts'`、`dependencies: ['chromium', 'seed']`）を足し、`chromium` と `seed` は `*.exclusive.spec.ts` を読まない。`pnpm e2e` では、ほかの全部が終わった後に 1 人で走る。
- CI は `e2e (4/4)` だけが、`seed` の後に `pnpm e2e --project exclusive --no-deps` を流す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| exclusive の project（採用） | 試験の中身を変えず、並列の worker と重ならない。`seed` と同じ形 | project が 1 つ増える |
| 全員ではなく、その試験が作った範囲だけをフォローする | project が要らない | 候補は全員から選ばれるので、0 にできない |
| `test.describe.configure({ mode: 'serial' })` | 設定が小さい | 他ファイルの worker とは重なったまま |
| `workers: 1` | 単純 | 全体が遅くなる |

## 結果

- フォローの試験の偶然の失敗が無くなる。
- DB の全体に書く試験を足すときは、`*.exclusive.spec.ts` にする（`docs/guides/verify.md`）。
- 最後に 1 人で走る分だけ、E2E の所要時間が少し伸びる。
