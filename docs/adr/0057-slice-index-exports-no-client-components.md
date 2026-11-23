---
type: ADR
title: "ADR-0057: slice の入口 index.ts は 'use client' の部品を公開せず、画面の部品は ui/index.ts から公開する"
description: "index.ts がクライアントの部品を再び公開していると、サーバーがその入口から処理を 1 つ import するだけで全部品がルートの JS に入る。入口は処理と型だけにし、'use client' の部品は ui/index.ts から公開する。検査のテストで守る。ADR-0053 を置き換える。"
tags: [architecture, performance]
status: stable
---

# ADR-0057: slice の入口 index.ts は 'use client' の部品を公開せず、画面の部品は ui/index.ts から公開する

- ステータス: 採用
- 日付: 2026-11-23
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0014](0014-code-in-feature-slices.md)、[ADR-0046](0046-performance-budget-in-verify-and-ci.md)、[ADR-0053](0053-slice-may-add-ui-entry-to-keep-components-out-of-index.md)（置き換える）、#106

## 背景

- 初期 JS（gzip）は上限 170,000 バイトの手前の 169,467 まで来ていた。`/` の最初の表示で使わない `StoryViewer`・`CommentSection`・`StoryComposer`・`PostTileGrid`・`NotificationList`・認証のフォームなどが読み込まれていた。
- 原因は、slice の入口 `src/features/<slice>/index.ts` が、サーバー用の処理と `'use client'` の部品を同じファイルから公開していること。サーバーの部品が入口から処理を 1 つ import するだけで、入口が再び公開している全てのクライアントの部品が、そのルートのクライアント参照に入る。
- 測定（2026-11-23、`scripts/perf/bundle.mjs`、同じビルドを 3 回測って同じ値）: import の経路だけを変えると 169,471 から 154,364 まで下がった。
- 入口を `index.ts` と `ui/index.ts` に分けただけでは 159,464（`ui/index.ts` を 1 つ import するだけで、それが再び公開する全てのクライアントの部品が入る）。サーバーの部品も `ui/index.ts` に移すと 167,776 に増え、`package.json` に `"sideEffects": ["*.css"]` を足すと 152,940 になった（Turbopack が使わない再公開を落とす）。
- [ADR-0053](0053-slice-may-add-ui-entry-to-keep-components-out-of-index.md) は、build が落ちる場合だけ `ui/index.ts` を許していた（admin・invite・notification）。この理由は build の失敗に限られ、JS の量は守れなかった。

## 決定

- `src/features/<slice>/index.ts` は、直接にも、そこから再び公開するファイルを辿っても、`'use client'` で始まるモジュールを公開しない（検査のテストが見る範囲）。
- 部品は全て `src/features/<slice>/ui/index.ts` から公開する: `'use client'` の部品（とその props の型・フック）に加え、それらを import するサーバーの部品も（サーバーの部品が `index.ts` にあると、処理を 1 つ import しただけで、その部品が import するクライアントの部品がルートの JS に入るため）。`index.ts` は処理・型・定数だけを公開する。他の slice もルートも、部品は `<slice>/ui` から、処理と型は `<slice>` から import する。深い経路（`<slice>/ui/Foo`）からは import しない。
- `ui/index.ts` は、サーバー専用の処理（`'use server'` のファイルと `server-only` を import するファイル）を公開しない。ただし [ADR-0053](0053-slice-may-add-ui-entry-to-keep-components-out-of-index.md) のとおり、サーバー専用の画面や経路を `ui/index.ts` から公開してよい場合は、`'use server'` と `server-only` を持たないものに限る。
- `src/shared/slice-entry.test.ts` が両方を検査し、違反を `<slice>/index.ts が <file> を公開しています。画面の部品は <slice>/ui/index.ts から公開します` の形で全て列挙する。
- ADR-0053 の「`ui/index.ts` を import するのはルートとレイアウトだけ」は採らない。他の slice の部品が `<slice>/ui` を import してよい。
- `package.json` に `"sideEffects": ["*.css"]` を足す。`ui/index.ts` が複数のクライアントの部品を再び公開していても、使う部品だけがルートの JS に入るようにするため（下の測定）。副作用のある import は CSS だけ（`src/app/layout.tsx` の `globals.css`）。今後、import するだけで効くモジュール（登録・グローバルな設定）を足すときは、`sideEffects` にそのファイルを足す。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 入口は処理と型、`'use client'` の部品は `ui/index.ts`（採用） | 規約の中で、使わない部品が JS に入らない。検査で機械的に守れる | slice ごとに入口が 2 つ。import の行が増える |
| 入口を分けたうえで `sideEffects` も宣言する（採用の一部） | `ui/index.ts` が複数の部品を公開しても使う分だけ入る。152,940 | import だけで効くモジュールは `sideEffects` に足す約束が要る |
| 入口を分けるだけで、`sideEffects` は宣言しない | 設定の変更なし | 159,464 で、目標 158,000 に届かない |
| ルートが深い経路から import する | 変更が小さい | slice の入口だけを import する規約（ADR-0014）に反する |
| `next/dynamic` で遅延読み込みする | 実行時に必要なときだけ読む | 入口の連鎖は直らない。他の部品にも効かず、今回の目標に要らない |
| 上限を上げる | 変更なし | 確かめを緩めるのはユーザーの決定（ADR-0046） |

## 結果

- 初期 JS が下がり、見た目の PBI（#89〜#100）が JS を足す余裕ができる（値は #106 の記録）。
- 守ること: 新しい `'use client'` の部品は `ui/index.ts` に足す。`index.ts` に足すと検査のテストが落ちる。
- 受け入れる費用: slice が 2 つの入口を持つ。import する側は処理と部品を別の行で import する。
