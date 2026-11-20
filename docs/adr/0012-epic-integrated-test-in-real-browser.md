---
type: ADR
title: "ADR-0012: EPIC が完了したら実ブラウザで総合試験を行い、エビデンスを commit する"
description: "子 PBI が全て閉じた EPIC は、epic-tester（sonnet）が本物の Chrome で EPIC の受け入れ条件を通しで操作する総合試験を行い、レポートと画面の写真を docs/test-reports/ に commit する。PASS になるまで EPIC は閉じない。"
tags: [process, testing, evidence]
status: stable
---

# ADR-0012: EPIC が完了したら実ブラウザで総合試験を行い、エビデンスを commit する

- ステータス: 採用
- 日付: 2026-11-20
- 決定者: ユーザー（EPIC 単位の総合試験、エビデンスの commit、実ブラウザ）。担当のエージェント・手順・レポートの形はエージェント
- 関連: [ADR-0004](0004-milestone-epic-pbi-with-dor-ac-dod.md)、[ADR-0007](0007-director-dispatches-sonnet-implementers-in-worktrees.md)、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)

## 背景

PBI ごとの E2E は、その PBI の範囲しか確かめない。PBI をまたぐ流れ（投稿してからフィードに出て、いいねされて通知が届く、など）は、どの PBI のテストにも現れないことがある。ヘッドレスの Playwright は、本物のブラウザで人が見る表示やコンソールのエラーを見落とすことがある。ユーザーは、EPIC が完了したら EPIC 単位の総合試験を行い、エビデンスを commit することと、総合試験は実ブラウザで行うことを指定した。

## 決定

- 子 PBI が全て閉じても、EPIC はまだ閉じない。Director が `epic-tester`（`model: sonnet`）を、専用の worktree（`epic-test/<N>`）とスロットで起動する。
- 総合試験は **本物の Chrome** で行う。`epic-tester` は chrome-devtools MCP で Chrome を操作し、EPIC の各 AC を利用者と同じ操作で通しで確かめる。ヘッドレスの Playwright は総合試験の代わりにならない。PBI の E2E と verify は回帰の補助の証拠として回す。
- 各 AC の結果が見える画面を、1280・768・375 px の幅で写真に撮る。シナリオごとに失敗の経路を 1 つ含める。訪れた全ての画面で、コンソールのエラーと警告、失敗した通信が 0 であることを確かめる。
- レポートは `docs/test-reports/epic-<NNNN>-<slug>.md`（`type: TestReport`）、写真とログは `docs/test-reports/evidence/epic-<NNNN>/` に置き、`main` に commit して push する。
- 実 Chrome は共有の資源なので、総合試験は同時に 1 つの EPIC だけにする。chrome-devtools MCP が使えないときは、Director が claude-in-chrome で同じ試験を行う。
- `FAIL` のときもレポートは commit する。原因ごとにバグの PBI を EPIC の下に起票し、通常のループで直してから、総合試験を最初からやり直す。EPIC は `PASS` になるまで閉じない。
- 手順の本体は `.claude/rules/delivery.md` §5 と `.claude/agents/epic-tester.md` に置く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 実 Chrome で sonnet の epic-tester が行う（採用） | 人が見るのと同じ表示とコンソールを確かめられる。エビデンスが残る | 1 度に 1 つしか走らせられない。時間がかかる |
| ヘッドレスの Playwright で総合試験 | 速い。並列にできる | 実ブラウザで行うというユーザーの指定に合わない |
| Director が毎回自分で行う | 受け渡しが無い | Director の文脈が写真と操作の記録で膨らむ |

## 結果

- EPIC を閉じるたびに、PBI をまたぐ流れを実ブラウザで確かめた記録が `main` に残る。
- エビデンスはリポジトリに入るので、写真は PNG で小さく保つ。動画は AC が動きを求めるときだけにする。
