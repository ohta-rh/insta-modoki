---
type: ADR
title: "ADR-0007: Director のメインセッションが、PBI ごとに sonnet の実装者を独立した worktree で動かす"
description: "メインセッションは Director として着手・レビューの手配・確認・統合だけを行い、コードは PBI ごとの pbi-implementer（sonnet）が専用の worktree と branch で書く。統合は Director が rebase と fast-forward で main に入れて push する。"
tags: [process, delivery, agents]
status: stable
---

# ADR-0007: Director のメインセッションが、PBI ごとに sonnet の実装者を独立した worktree で動かす

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（Director と sonnet サブエージェント、独立した worktree）。統合の手順とスロット数はエージェント
- 関連: [ADR-0005](0005-map-dependencies-for-parallel-work-at-filing.md)、[ADR-0008](0008-share-one-compose-stack-with-a-slot-per-worktree.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0010](0010-independent-code-and-security-review.md)

## 背景

ユーザーは、デリバリーを Director のメインセッションが sonnet のサブエージェントを呼んで行い、サブエージェントはそれぞれ独立した worktree を持つと指定した。ユーザーの全体ルールには次のものがある。並列のエージェントが作業ツリーを共有すると、互いの作業を上書きする。worktree は起動の前に割り当て、起動後に確かめ、違えば止める。作業は `main` に入れて push する。

## 決定

- メインセッションは Director。着手する PBI を決め、worktree を作り、サブエージェントを起動し、結果を確かめ、`main` に統合して push し、issue を閉じる。PBI のコードは自分では書かない。
- PBI 1 つにつき `pbi-implementer`（`model: sonnet`）を 1 つ起動する。worktree は Director が起動の前に `.worktrees/pbi-<N>`（branch `pbi/<N>`、`origin/main` から）に作る。起動後に、実装者が報告した toplevel と branch を確かめ、違えばその着手を止める。
- 同時に進める PBI は最大 4 つ（スロット 1〜4）。
- 実装者は自分の branch に commit するだけで、push しない（`ALLOW_COMMIT=true`）。
- 統合は 1 つずつ行う。`origin/main` に rebase し、何か変わったら verify をやり直し、`main` に fast-forward で merge して push する。その後、worktree と branch を名前を指定して消す。
- 手順の本体は `.claude/rules/delivery.md` と `.claude/agents/pbi-implementer.md` に置く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Director + PBI ごとの sonnet 実装者 + 専用 worktree（採用） | 並列にできる。作業が混ざらない。Director の文脈が軽く保たれる | worktree の準備と統合の手間 |
| メインセッションが全部実装する | 受け渡しが無い | 並列にできない。文脈が膨らむ |
| 1 つの作業ツリーで複数のエージェント | 準備が要らない | 互いの変更を上書きする |
| `isolation: "worktree"` に任せる | 手順が少ない | パスと branch 名を決められず、スロットと結び付けられない。黙って失敗することがある |

## 結果

- `main` には、レビューと verify を通った PBI が 1 つずつ fast-forward で入る。
- スロット数の 4 は、手元のマシンの負荷を見て ADR で変える。
