---
type: ADR
title: "ADR-0017: PR を求められたマイルストーンは統合ブランチに入れ、main への PR を 1 つ出す"
description: "ユーザーが PR を求めたときは、PBI を main ではなく m<N>/<slug> の統合ブランチに fast-forward で入れ、そこから main への PR を 1 つ出す。issue は PR のマージで閉じる。"
tags: [process, git, delivery]
status: stable
---

# ADR-0017: PR を求められたマイルストーンは統合ブランチに入れ、main への PR を 1 つ出す

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: ユーザー（「M1全部やってPR出しといて」）。ブランチの形と issue の閉じ方はエージェント
- 関連: [ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)、[ADR-0012](0012-epic-integrated-test-in-real-browser.md)

## 背景

ADR-0007 は、PBI を `main` に fast-forward で入れて push すると決めている。ユーザーのグローバルのルールでは、ユーザーが PR を求めたときだけブランチと PR を使う。ユーザーは M1 の全部を PR で出すよう指示した。

## 決定

- マイルストーン N の作業は、`main` から切った統合ブランチ `m<N>/<slug>`（M1 は `m1/local-mvp`）に入れる。
- PBI の worktree は統合ブランチから切り、統合は統合ブランチへの rebase と fast-forward で行う。統合ブランチは毎回 push する。
- `main` への PR は 1 つ。最初の commit の後に下書きで出し、PBI や EPIC の総合試験が終わるたびに本文を更新する。全部が終わったら下書きを外す。マージはユーザーが行う。
- issue は統合の時点で DoD に印を付け、commit と確認結果をコメントに書くが、閉じない。PR の本文の `Closes #N` で、マージのときに閉じる。
- EPIC の総合試験は統合ブランチの最新の commit で行う。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 統合ブランチ + PR 1 つ（採用） | ユーザーが 1 か所で全体を見てマージを決められる | 統合ブランチと main の差が大きくなる |
| PBI ごとに PR | 小さく見られる | 22 の PR のマージをユーザーに渡すことになる |
| main に直接入れる（ADR-0007 のまま） | 手間が少ない | PR を求めた指示に合わない |

## 結果

- `main` は PR のマージまで変わらない。
- PR を求められないマイルストーンは、引き続き ADR-0007 のとおり `main` に入れる。
