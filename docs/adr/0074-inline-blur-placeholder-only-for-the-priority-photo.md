---
type: ADR
title: "ADR-0074: ぼかしの PNG は優先読み込みの写真だけに埋め込み、ほかの写真は ThumbHash の平均の色を背景にする"
description: "フィードの全ての写真に PNG の data URL（約 5.7KB）を埋めると / の HTML が 306KB になり LCP が 2.5 秒を超えた。priority の写真だけ PNG、ほかは平均の色。"
tags: [performance, feed]
status: stable
---

# ADR-0074: ぼかしの PNG は優先読み込みの写真だけに埋め込み、ほかの写真は ThumbHash の平均の色を背景にする

- ステータス: 採用
- 日付: 2026-11-25
- 決定者: エージェント（委任された判断。#132）
- 関連: [ADR-0046](0046-performance-budget-in-verify-and-ci.md)

## 背景

- `MediaImage` は全ての写真に ThumbHash から作った PNG の data URL（1 個 約 5.7KB）を `backgroundImage` で埋めていた。seed:bench のログイン後の `/` は HTML が 305.9KB で、うち data URL が 23 個で 120KB。
- 遅い 4G の想定で HTML の受け取りが遅れ、`perf` の `/` の LCP が 2859〜2875ms で基準 2500ms を超えた（CI run 45581233580）。
- 優先読み込みの写真だけに PNG を残し、ほかを平均の色にした実験では LCP が 2258ms になった。

## 決定

- `priority` の写真だけが `thumbhashDataUrl` の PNG を背景にする。
- `priority` でない写真は `thumbhashAverageColor`（`rgb(r g b)`）を `background-color` にし、`data:` は埋めない。ThumbHash が壊れているときは背景を付けない。
- 基準値（THRESHOLDS）は変えない。`PostTileGrid` のタイルは対象外。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| priority だけ PNG、ほかは平均の色（採用） | HTML が小さくなり、最初の写真のぼかしは残る | 画面の外の写真は単色から写真に変わる |
| 基準値を緩める | 変更が無い | ADR-0046 の基準を満たさないまま通す |
| PNG を CSS やクライアントで後から作る | HTML が小さい | 実装が増え、最初の描画に間に合わない |

## 結果

- `/` の HTML から画面の外の写真の PNG が消え、LCP が基準の内側に入る。
- 2 枚目以降の写真は、届くまで単色で見える。
