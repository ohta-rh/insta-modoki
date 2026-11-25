---
type: ADR
title: "ADR-0067: 統合ブランチの CI が赤いときは、ほかの作業より先に直す。ci-gate で機械的に確かめる"
description: "scripts/ci-gate.mjs が統合ブランチの最新の CI を読み、0 緑・1 赤・2 道具の失敗・3 待ちで終わる。Director は dispatch の前と push の後にこれが 0 であることを確かめ、SessionStart のフックが同じ 1 行をセッションの文脈に入れる。"
tags: [delivery, ci, director]
status: stable
---

# ADR-0067: 統合ブランチの CI が赤いときは、ほかの作業より先に直す。ci-gate で機械的に確かめる

- ステータス: 採用
- 日付: 2026-11-24
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0017](0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)、[ADR-0027](0027-ci-runs-verify-and-docs-check.md)、#115

## 背景

- 2026-11-23 08:37、`m2/cloudflare-demo` の CI（80310ed）が 20 分の時間切れで取り消された。Director は #109 を起票しただけで、積み上げた PBI の verify を続けた。
- 2026-11-24 に、利用者に指摘されるまで気づかなかった。
- `delivery.md` §2 の 1 は `main` の verify が緑であることを求めるが、統合ブランチの CI の状態を確かめる道具がなく、Director の記憶に頼っていた。

## 決定

- `scripts/ci-gate.mjs <ブランチ>` を足す。`gh run list --branch <b> --workflow CI --limit 1` を読み、0（緑）・1（`failure` / `cancelled` など。run の URL を出す）・2（`gh` が使えない）・3（実行中、または先頭の SHA の CI がまだない）で終わる。読むだけで、push も再実行もしない。
- 統合ブランチの名前は `git config insta.integrationBranch` から読み、なければ `main` とする。Director は統合ブランチを作ったときに設定する。
- `.claude/settings.json` の SessionStart のフックが、この名前を引数に `ci-gate` を呼び、出力の 1 行を Director の文脈に入れる。フックは `|| true` で終わり、終了コードでセッションを止めない。
- `delivery.md` §2 の 1（dispatch の前）と §4 の 2（push の後、次の統合の前）に、`ci-gate` が 0 であることを書く（#114 で書いた）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Director の記憶と、ルールの文言だけ（現状） | 変更なし | 2026-11-23 に赤を見逃した |
| ci-gate + SessionStart のフック + delivery.md（採用） | 作業の前と push の後に機械が知らせる。道具は読むだけで安全 | `gh` の認証と統合ブランチの設定が要る |
| GitHub の通知（メール・Slack）に任せる | 道具が要らない | Director の文脈に入らない |
| CI の失敗で自動的に再実行・修正する | 手間が減る | 原因ごとの判断が要る。範囲外 |

## 結果

- 赤い統合ブランチのまま次の dispatch に進むことを、セッションの始めの 1 行と §2・§4 の手順が止める。
- 受け入れる費用: セッションの開始ごとに `gh` を 1 回呼ぶ。`gh` が使えなければ終了コード 2 の 1 行が出るだけで、セッションは止まらない。
- 守ること: 統合ブランチを作ったら `git config insta.integrationBranch` を設定する。CI のワークフロー名を変えるなら `ci-gate` の `--workflow CI` も変える。
