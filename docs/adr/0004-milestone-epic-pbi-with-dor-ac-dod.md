---
type: ADR
title: "ADR-0004: issue はマイルストーン → EPIC → PBI の順に起票し、全てに DoR・AC・DoD を書く"
description: "作業は GitHub の Milestone、EPIC の issue、PBI の issue の 3 段で上から順に起票する。どの段にも準備完了の定義・受け入れ条件・完了の定義を必ず書く。"
tags: [process, issues]
status: stable
---

# ADR-0004: issue はマイルストーン → EPIC → PBI の順に起票し、全てに DoR・AC・DoD を書く

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（3 段の順番と DoR・AC・DoD の必須化）。テンプレートの形はエージェント
- 関連: [ADR-0005](0005-map-dependencies-for-parallel-work-at-filing.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)

## 背景

デリバリーはサブエージェントが issue だけを仕様として進める（[ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)）。issue に着手できる条件や終わりの条件が書かれていないと、エージェントはどこで止めるかを推測するしかない。ユーザーは、マイルストーン・EPIC・PBI の順に起票し、issue に必ず DoD・AC・DoR を書くと指定した。

## 決定

- 計画は 3 段で、上から順に起票する。マイルストーンは GitHub の Milestone、EPIC は `epic` ラベルの issue、PBI は `pbi` ラベルの issue で EPIC の sub-issue にする。
- Milestone の説明、EPIC、PBI の全てに「準備完了の定義（DoR）」「受け入れ条件（AC）」「完了の定義（DoD）」の 3 つの節を書く。どれかが欠けた issue や、仮置きが残った issue は起票しない。
- AC は観測できる形で書き、それぞれに確認方法を付ける。画面で観測できる AC には E2E のシナリオを書く。
- Director は、PBI の DoR を全て満たしたことを確かめてから着手させる。
- テンプレートと細則は `.claude/rules/issue-authoring.md` に置く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 3 段 + DoR・AC・DoD 必須（採用） | 着手と完了の条件が issue だけで分かる。サブエージェントに渡せる | 起票に手間がかかる |
| EPIC + PBI の 2 段（兄弟プロジェクト） | 軽い | リリースの単位が issue に現れない |
| 自由形式の issue | 速い | 終わりの判断がエージェントの推測になる |

## 結果

- PBI の issue 1 つで、実装者もレビュアーも同じ仕様を見る。
- DoR を満たさない PBI は、issue を直してから取り掛かる。
