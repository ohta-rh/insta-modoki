---
type: ADR
title: "ADR-0010: コードレビューとセキュリティレビューを、それぞれ独立した sonnet のサブエージェントで行う"
description: "レビューは毎回、code-reviewer と security-reviewer の 2 つの読み取り専用のサブエージェントを同時に起動して行う。渡すのは issue 番号・worktree・スロット・差分の範囲だけで、両方が APPROVE を返すまで繰り返す。"
tags: [process, review, security]
status: stable
---

# ADR-0010: コードレビューとセキュリティレビューを、それぞれ独立した sonnet のサブエージェントで行う

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（2 つを独立したサブエージェントで行う。sonnet を使う）。渡すものと判定の形はエージェント
- 関連: [ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)

## 背景

`main` に直接入れる運用では、レビューが唯一の第二の目になる。作者の要約を渡されたレビュアーは、その結論を追認しやすい。ユーザーは、security review と code review を、それぞれ独立したサブエージェントで行い、デリバリーは sonnet のサブエージェントで行うと指定した。ユーザーの全体ルールでは、レビューは opus の層に置くことになっている。今回はこのプロジェクトへの明示の指定を優先し、sonnet にした。

## 決定

- レビューのたびに `code-reviewer` と `security-reviewer`（どちらも `model: sonnet`、読み取り専用）を、1 つのメッセージで同時に起動する。
- 渡すのは、issue 番号・worktree のパス・スロット番号・差分の範囲だけ。実装者の要約や判断は渡さない。
- code-reviewer は、正しさ・AC とテスト・TDD・ADR との整合・Workers の実行環境・ブランドの線引き・docs を見る。security-reviewer は、認証と認可・入力・セッションと CSRF・アップロード・データの露出・シークレット・乱用を見る。どちらも、示せない指摘は出さない。
- Director は、指摘を 1 つずつ自分で確かめる。本物は実装者にテストを先に書かせて直させ、誤りは根拠を付けて退ける。
- コードが変わったら、両方を新しいサブエージェントで起動し直す。両方が `APPROVE` を返すまで繰り返す。
- 判定の形は `.claude/agents/code-reviewer.md` と `.claude/agents/security-reviewer.md` に置く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 2 つの独立したレビュアーを同時に（採用） | 観点が混ざらない。同時に動くので待ち時間が増えない | 1 回のレビューの費用が 2 倍 |
| 1 つのレビュアーで両方を見る | 安い | セキュリティの観点が後回しになりやすい |
| レビュアーを opus にする（全体ルール） | 判断の質が高い | ユーザーがこのプロジェクトで指定した sonnet と違う |

## 結果

- PBI は、2 つのレビュアーが両方とも APPROVE を返さないと統合されない。
- sonnet のレビューで見逃しが続いたら、レビュアーの層を変える ADR を出す。
