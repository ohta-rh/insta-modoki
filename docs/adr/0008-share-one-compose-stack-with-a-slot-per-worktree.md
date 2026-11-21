---
type: ADR
title: "ADR-0008: worktree の間で compose のスタックを 1 つ共有し、スロットごとにポート・データベース・バケットを分ける"
description: "docker compose のスタック（プロジェクト名 insta-modoki）は main のチェックアウトから 1 つだけ起動し、全ての worktree が共有する。worktree ごとのスロット番号で、ポート・データベース名・バケット名を分ける。"
tags: [environment, parallel, docker]
status: deprecated
superseded_by: 0023-slots-with-garage-and-d1-files.md
---

# ADR-0008: worktree の間で compose のスタックを 1 つ共有し、スロットごとにポート・データベース・バケットを分ける

- ステータス: 置き換え: [ADR-0023](0023-slots-with-garage-and-d1-files.md)（DB が D1 になり、DB の名前と `.env.local` を使わなくなった）
- 日付: 2026-11-20
- 決定者: エージェント（委任された判断。ユーザーは「docker の共有方法を検討する」と指示した）
- 関連: [ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)

## 背景

最大 4 つの worktree が同時にテストと E2E を走らせる（[ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)）。どれも同じ種類の backing service（データベース、S3 互換のストレージ）を使う。データを共有すると、テストがお互いを壊す。ポートが同じだと起動できない。docker compose は、作業ディレクトリの名前からプロジェクト名を決めるのが既定なので、worktree ごとに別のスタックが勝手にできうる。

## 決定

- compose のプロジェクト名を `compose.yaml` の `name: insta-modoki` に固定する。スタックは main のチェックアウトから 1 つだけ起動し、全ての worktree が共有する。
- worktree は自分のスタックを起動しない。アプリ・テスト・Playwright はホストで動かし、スロットの env ファイルで共有のサービスにつなぐ。
- Director が PBI ごとにスロット番号 `N`（1〜4。main は 0）を割り当てる。
  - アプリのポート: `3000 + N`
  - データベース: `insta_s<N>`（アプリと E2E）、`insta_s<N>_test`（結合テスト）。テストランナーの並列の worker には後ろに番号を足す
  - バケット: `insta-s<N>`
  - env ファイル: worktree の `.env.local`（commit しない）
- ファイルで持つローカルの状態（D1/SQLite のローカルのファイル、`.wrangler/state`）は worktree の中に置く。それだけで分かれるので、着手のときに初期化するだけでよい。
- 着手と後片付けのとき、Director がスロットのデータベースとバケットを作り直す。共有のスタックを止める・作り直すのは Director だけ。
- `compose.yaml` やサービスの設定を変える PBI は、その Wave で単独にする。
- スロットを準備・初期化するスクリプトは、`compose.yaml` を足す PBI で一緒に作る。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 共有スタック 1 つ + スロットで名前を分ける（採用） | コンテナは 1 組だけで、メモリと起動時間が少ない。どの worktree からも同じ版のサービスにつながる | サービスの設定を変える PBI は並列にできない。名前の規則を守る必要がある |
| worktree ごとに compose のプロジェクトを立てる（`COMPOSE_PROJECT_NAME` とポートをずらす） | 完全に分かれる | データベースとストレージが最大 5 組。ポートの割り当てが複雑。後片付けの漏れでボリュームが残る |
| テストごとに Testcontainers で起動する | テストが自己完結する | 遅い。E2E とアプリの開発サーバーには合わない |

## 結果

- 4 つの PBI が同時にテストを走らせても、データが混ざらない。
- サービスの版を上げるときは、単独の PBI で行う。merge の後、次の Wave の前に、Director が共有のスタックに反映する。
- ルール本体は `.claude/rules/local-environment.md` に置く。
