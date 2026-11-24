---
type: ADR
title: "ADR-0072: main checkout は統合ブランチの上にいて、ハーネスの差は SessionStart で知らせる"
description: "Director のセッションと subagent の定義は main checkout の作業ツリーから CLAUDE.md と .claude/ を読むので、統合は main checkout で行い、統合用の worktree は作らない。scripts/harness-drift.mjs が違いを SessionStart で知らせる。"
tags: [delivery, harness, director]
status: stable
---

# ADR-0072: main checkout は統合ブランチの上にいて、ハーネスの差は SessionStart で知らせる

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0017](0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)、[ADR-0067](0067-red-integration-ci-comes-first.md)、#129、EPIC #110

## 背景

- EPIC #110 の総合試験（2026-11-24、`cc7eef4`）で、AC-5（Evidence の節）と AC-6（長い文字の AC）が FAIL だった。ハーネスの直しは統合ブランチに入っていたのに、効いていなかった。
- Director のセッションと subagent の定義は、main checkout の作業ツリーから `CLAUDE.md` と `.claude/` を読む。main checkout は古い `m1/local-mvp`（`origin/m1/local-mvp` から 94 commit 遅れ）のままで、統合は別の worktree（`.worktrees/m2`）で行っていた。
- `git show m1/local-mvp:.claude/agents/code-reviewer.md` の `rc=` は 0 件、`origin/m2/cloudflare-demo` では 3 件。それを知らせる検査も無かった。

## 決定

- 統合ブランチを作ったら、main checkout をその枝に切り替える。統合は main checkout で行い、統合用の worktree は作らない（`delivery.md` §4）。
- `scripts/harness-drift.mjs <ブランチ>` が `git diff --name-only HEAD origin/<ブランチ> -- CLAUDE.md .claude` を流し、0（同じ）・1（違う。ファイルを最大 20 行挙げる）・2（引数なし、`origin/<ブランチ>` なし、git の失敗）で終わる。読むだけで、作業ツリーの未 commit の差は数えない。
- SessionStart の hook は `ci-gate` に続けて `harness-drift` を流す（`timeout 30`、どちらも `|| true`）。新しいハーネスを統合した後は、`harness-drift` が 0 で終わることを確かめる。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 統合用の worktree を使い続ける（現状） | main checkout を動かさない | ハーネスが PR の merge まで効かない |
| main checkout を統合ブランチに切り替え、差を SessionStart で知らせる（採用） | 統合直後からルールが効く。差が見える | 切り替えを忘れると差の報告だけが頼り |
| subagent に別の checkout のルールを読ませる | main checkout を動かさない | 定義の読み込み元を変えられない |

## 結果

- 統合ブランチに入れたハーネスの決まりが、次のセッションから Director と subagent に効く。
- 切り替えの作業は Director が行う。`.worktrees/m2` を外してから切り替える。
- 統合ブランチの名前は `git config insta.integrationBranch`（ADR-0067）と共有する。
