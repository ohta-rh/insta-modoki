---
type: ADR
title: "ADR-0059: 結合テストは単独で上限の 25% 以内に収め、verify の int-budget で変わったファイルを測る"
description: "ホストが混むとテストの時間は 3〜4 倍に延びる。結合テストを 1 本ずつ流して各テストの所要時間が上限の 25% 以下かを verify の既定の手順 int-budget で見て、時間切れしやすいテストを入ったときに止める。上限と assertion は緩めない。"
tags: [verify, testing]
status: stable
---

# ADR-0059: 結合テストは単独で上限の 25% 以内に収め、verify の int-budget で変わったファイルを測る

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0024](0024-verify-command-and-coverage-gate.md)、[ADR-0046](0046-performance-budget-in-verify-and-ci.md)、[ADR-0058](0058-seed-integration-test-runs-in-its-own-verify-step.md)、#107

## 背景

- 2026-11-23 だけで verify が 2 回、変更と関係の無い結合テストの `Test timed out in 5000ms` で落ち、再実行に 1 回 10 分以上かかった。#78・#79 に続いて 3 回目で、毎回 1 本ずつ上限を足してきた（`load-post-views` 30 秒、`create-story` 60 秒、`search-users` 60 秒）。
- 単独で 1,368ms のテストが、結合テスト全体を並べると 3,089ms、混んだホストの verify で 5,062ms（3.7 倍）になった。
- 1 つの確認で 5 秒を超えそうなテストを後から 1 本ずつ直すやり方では止まらない（CLAUDE.md「A mistake that happens twice becomes a check」）。

## 決定

- 結合テストの各テストは、単独で流して、そのテストの上限（vitest の `testCase.options.timeout`。既定 5,000ms、個別の上限ならその値）の 25% 以下で終わること。25% は 4 倍に延びても上限に収まる値。
- verify の既定の手順 `int-budget`（`scripts/int-budget.mjs`）が、基準のコミットから変わった `*.int.test.ts`（コミット済み・変更中・未追跡）を `--no-file-parallelism` で 1 本ずつ流して測る。`--all` で全部を測る。
- 基準のコミット: 環境変数 `INT_BUDGET_BASE` が解決できればそれ。なければ、候補 `origin/$GITHUB_BASE_REF`（設定されているとき。PR の CI）・全ての `origin/m*/*`（統合ブランチ）・`origin/main` のそれぞれについて `git merge-base HEAD <候補>` を求め、`<基準>..HEAD` の commit 数が一番少ないもの（同数なら先の候補）を使う。統合ブランチから切ったブランチで `origin/main` だけを基準にすると、統合ブランチが先へ進んだ分の全ての結合テストを測ってしまうため（2026-11-23、`origin/main` が m2 より 313 commit 遅れて約 70 ファイル）。どの候補も解決できなければ全部を測る。
- ファイル名は NUL 区切り（`git diff -z`）で読み、`-` で始まる名前は vitest のオプションと取り違えられるので測らない（vitest の絞り込みには `--` が効かず、後ろを無視して全部を流すため。2026-11-23 に確かめた）。
- 超えたテストのファイルだけをもう 2 回流し、3 回の最小で判定する（ホストの負荷は時間を延ばす方向にしか働かないので、1 回だけの遅れで落ちる確認を作らない）。
- `seed.int.test.ts` と `scripts/slot.int.test.ts` は測らない（どちらも計測した上限を持ち、測ると数分かかりバケットを触る）。
- 超えたテストは、往復をまとめる（`t.db.batch`）・並べる（`Promise.all`）か、計測した所要時間を書いたコメントつきで個別の上限を付けて直す。vitest の既定の `testTimeout` と assertion は緩めない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 変わったファイルを 1 本ずつ測り、25% を予算にする（採用） | 遅くなるテストを入れた PBI で止められる。測る量が小さい | 変わっていないファイルの劣化は `--all` を流すまで分からない |
| 全ての結合テストを毎回測る | 漏れが無い | 単独で 168 秒以上かかり、verify が長くなる |
| 時間切れしたテストの上限を後から足す | 変更が小さい | 3 回繰り返した。次を止められない |
| 既定の `testTimeout` を上げる | 全部に効く | 門を緩める変更で、利用者だけが決める |

## 結果

- 時間切れしやすいテストが、それを入れた PBI の verify で分かる。
- 受け入れる費用: 変わった結合テストの分だけ、verify が単独実行の時間（と、超えたときの 2 回の再実行）だけ延びる。
- 守ること: 予算の 25% を変える・測る対象を狭めるのは門を緩める変更なので、新しい ADR で利用者が決める。
