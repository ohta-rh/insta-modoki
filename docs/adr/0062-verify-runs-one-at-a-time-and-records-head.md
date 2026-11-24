---
type: ADR
title: "ADR-0062: verify は同じマシンで一度に 1 つだけ走り、確かめた HEAD を出力に残す"
description: "verify が git-common-dir のロックのファイルで同じマシンの他の verify を待ち（60 分まで）、始めと終わりの HEAD・負荷を出力に残し、実行中に HEAD が動いたら失敗する。重なった verify の時間切れと、古い結果の読み違えを人の手順に頼らず防ぐ。"
tags: [verify, testing]
status: stable
---

# ADR-0062: verify は同じマシンで一度に 1 つだけ走り、確かめた HEAD を出力に残す

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0027](0027-ci-runs-verify-and-docs-check.md)、[ADR-0059](0059-integration-tests-stay-within-a-quarter-of-their-timeout.md)、#111

## 背景

- 2026-11-23〜24、worktree ごとの verify が重なり、結合テストと E2E が時間切れで落ちた。pbi-93 の verify は load average 23〜29 で E2E の 8 件がサインアップの 5 秒で落ち、同じ変更の前の回では通っていた。
- rebase や merge の後に、前の HEAD の verify がまだ走っており、止めて流し直すことが何度もあった。結果がどの commit のものかは出力のどこにもない。
- 直列化（#107 / ADR-0059 の後、Director の作業用スクリプト）と HEAD の照合は人の手順に頼っていた。`scripts/verify.mjs` は他の verify も commit も見ない。

## 決定

- verify は、`$(git rev-parse --git-common-dir)/insta-verify.lock`（全ての worktree で同じ場所）を `openSync(path, 'wx')` で作って取る。中身は 1 行の JSON `{pid, head, worktree, startedAt}`。`--list` と不正な引数はロックを取らない。`--only` は取る。
- すでにあるとき、その pid が `process.kill(pid, 0)` で生きていれば（`EPERM` も生きている）10 秒ごとに見直して待つ。1 分ごとに待っている旨を 1 行出し、60 分を超えたら `verify: 60 分待っても別の verify が終わりません` を出して 1 で終わる。生きていなければ（`ESRCH`、読めない中身も）`引き継ぎます` と出して消し、取り直す。
- ロックは成功・失敗・exit・SIGINT・SIGTERM で外す。外すのは自分の pid のロックだけ。シグナルでは実行中の手順にも同じシグナルを送る（手順は非同期の `spawn` で流し、待つ間もシグナルを受けられるようにした）。
- 始めに `verify: HEAD <短い SHA> <ブランチ>` と `verify: load average <1 分値> / CPU <論理コア数>` を出す（負荷は表示だけで判定に使わない）。最後の手順の後に HEAD を読み直し、動いていれば `verify: FAIL HEAD が実行中に <a> から <b> に変わりました` で 1 で終わる。通れば最後の行は `verify: OK <短い SHA>`。
- `main` は非同期になった（戻り値は終了コードの Promise）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Director の作業用スクリプトで直列にする（現状） | コードを足さない | worktree の外から流す verify や人の手の verify を守れない。HEAD も残らない |
| `flock` などの OS のロック | プロセスが死ぬと自動で外れる | macOS に `flock` が無く、Windows で動かない。待つ側の表示も作れない |
| 負荷（load average）が高いと待つ | 他の重い処理も避けられる | 閾値の根拠が無く、判定が揺れて落ちる・止まる原因になる。表示だけにした |
| ロックのファイル + 生きている pid の確認（採用） | 依存なし。どの worktree からも同じ場所。死んだ verify のロックは自動で引き継ぐ | pid の再利用で、死んだロックを生きていると読む場合がある（上限 60 分で止まる）。引き継ぎの 2 つの verify が同時に消して取り直す競合は、窓が狭いので受け入れる |

## 結果

- 重なった verify の時間切れが無くなり、出力の最後の行が確かめた commit を持つので、古い結果を緑と読み違えない。
- 受け入れる費用: 先の verify が長いと、後の verify は最大 60 分待つ。待つ間は動かない（動かないことが目的）。
- 守ること: 新しい入口（スクリプト・CI）が verify を流すときは `scripts/verify.mjs` を通す。CI は job ごとに別のマシンなのでロックの対象外（`concurrency` が扱う）。
