---
type: ADR
title: "ADR-0045: chrome-devtools の MCP が使えないとき、epic-tester は画面ありの Google Chrome を CDP で操作して総合試験を行う"
description: "総合試験は引き続き本物の Chrome で行う。chrome-devtools の MCP の Chrome が使えないときの手段として、Playwright の channel: 'chrome'・headless: false で起動した Google Chrome（使い捨てのプロファイル）を CDP で操作することを認める。ヘッドレスと同梱の Chromium は引き続き認めない。"
tags: [process, testing, evidence]
status: stable
---

# ADR-0045: chrome-devtools の MCP が使えないとき、epic-tester は画面ありの Google Chrome を CDP で操作して総合試験を行う

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断。Director）
- 関連: [ADR-0012](0012-epic-integrated-test-in-real-browser.md)、[EPIC #1 の総合試験のレポート](../test-reports/epic-0001-dev-foundation.md)

## 背景

- [ADR-0012](0012-epic-integrated-test-in-real-browser.md) は、総合試験を本物の Chrome で行い、`epic-tester` が chrome-devtools の MCP で操作し、使えないときは Director が claude-in-chrome で行うと決めた。
- 2026-11-21 の EPIC #1 の総合試験で、`epic-tester` は chrome-devtools の MCP の Chrome を開けなかった（`The browser is already running for /Users/…/.cache/chrome-devtools-mcp/chrome-profile`）。そのプロファイルは、このリポジトリと関係の無い別のセッションの Chrome（11 月 16 日から動いている）が使っていた。他のセッションの Chrome は止めない。
- Director が claude-in-chrome で試験したが、利用者の Chrome のウィンドウは 1440px（倍率 90%）より狭くできず、ADR-0012 が求める 375px の写真を撮れなかった。代わりに、使い捨てのプロファイルで起動した画面ありの Google Chrome 157 を、Playwright の `channel: 'chrome'`・`headless: false` で起動し、CDP で表示の幅を変えて写真を撮った。chrome-devtools の MCP も同じく CDP で Chrome を操作している。
- 残りの EPIC（#2・#3・#4・#5・#6・#7）の総合試験を全て Director が自分で行うと、Director の文脈が写真と操作の記録で膨らみ、PBI の取りまとめが止まる（ADR-0012 が退けた選択肢と同じ問題）。

## 決定

- 総合試験は引き続き **本物の Google Chrome（画面あり）** で行う。ヘッドレスのモード、Playwright 同梱の Chromium、`chromium.launch()` の既定は総合試験として数えない。
- `epic-tester` は、まず chrome-devtools の MCP を使う。`list_pages` が 2 回失敗したら、次の手段に切り替える（`BLOCKED` にしない）: Playwright の `chromium.launch({ channel: 'chrome', headless: false })` で、使い捨てのプロファイルの Google Chrome を起動し、CDP で操作する。`page.setViewportSize` で 1280・768・375px にして写真を撮り、`console`・`pageerror`・`requestfailed`・`response` の出来事を数える。
- レポートの「対象」に、使った手段と Chrome の版（`browser.version()`）を書く。操作のスクリプトは worktree の `.tmp_*/` に置き、commit しない。
- 両方とも使えないときだけ `BLOCKED` を返し、Director が claude-in-chrome で行う（ADR-0012 のまま）。
- 総合試験は同時に 1 つの EPIC だけ、という決まりは変えない（画面ありの Chrome が 2 つ並ぶと、写真と操作が干渉しうる）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 画面ありの Google Chrome を CDP で操作する手段を足す（採用） | 本物の Chrome のまま。375px を正確に作れる。`epic-tester` に任せられる | MCP とは別の起動の仕方を覚える必要がある |
| 他のセッションの Chrome を止めて MCP のプロファイルを空ける | 決まりを変えない | 関係の無い作業を壊す。また握られれば同じことが起きる |
| Director が毎回 claude-in-chrome で行う | 決まりを変えない | 375px を作れない。Director の文脈が膨らむ |
| ヘッドレスの Playwright で行う | 速い | 実ブラウザで行うというユーザーの指定（ADR-0012）に反する |

## 結果

- chrome-devtools の MCP が他のセッションに握られていても、`epic-tester` が総合試験を続けられる。
- 実ブラウザで確かめるという ADR-0012 の決定は変わらない。変わるのは操作の手段だけで、ADR-0012 の「Director が claude-in-chrome で行う」は 3 番目の手段になる。
- 手順の本体は `.claude/rules/delivery.md` §5 と `.claude/agents/epic-tester.md` に置く。
