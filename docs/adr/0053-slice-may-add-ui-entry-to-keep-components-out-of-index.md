---
type: ADR
title: "ADR-0053: slice は、他の slice が import する index.ts に部品を入れられないとき、ルートが使う部品の入口 ui/index.ts を別に持てる"
description: "他の slice のサーバー処理が import する index.ts に、サーバー専用の画面などの部品を載せると、クライアントの import の連鎖に入って build が落ちる。そのときは index.ts を処理の入口だけにし、画面と部品は ui/index.ts から、ルートとルートのレイアウトが import する。"
tags: [architecture]
status: stable
---

# ADR-0053: slice は、他の slice が import する index.ts に部品を入れられないとき、ルートが使う部品の入口 ui/index.ts を別に持てる

- ステータス: 採用
- 日付: 2026-11-22
- 決定者: エージェント（委任された判断。Director が採番）
- 関連: [ADR-0014](0014-code-in-feature-slices.md)、#50

## 背景

[ADR-0014](0014-code-in-feature-slices.md) は、機能をまたぐ呼び出しを slice の公開する入口 `index.*` だけに通すと決めた。通知（#50）の `src/features/notification/index.ts` は、`like`・`comment`・`follow` のサーバー処理が import する（`insertLikeNotification` など 5 つの文）。ここに画面 `NotificationsPage`（`next/headers` を使うサーバー専用）を同じ index から公開したところ、`pnpm build` が次のエラーで落ちた。

- `You're importing a module that depends on "next/headers". This API is only available in Server Components ...`（`./src/features/notification/ui/NotificationsPage.tsx`）
- import の連鎖（build のログ）: `src/app/[username]/page.tsx` → `profile/ui/PostGrid.tsx`（クライアント）→ `post/index.ts` → `post/ui/PostDetail.tsx` → `comment/index.ts` → `comment/api/add-comment.ts` → `notification/index.ts` → `NotificationsPage.tsx`。

既存の slice の `index.ts` は処理と部品を一緒に公開しており（`like/index.ts` など）、部品どうしの連鎖がクライアントに入ることは今まで無かった。通知は、処理だけを他の slice が使い、その連鎖の中にクライアントのコードがある、初めての場合だった。

## 決定

- 他の slice のサーバー処理が import する `index.ts` には、部品（React のコンポーネント）を載せない。そのときだけ、slice は `ui/index.ts` を持ってよい。
- `ui/index.ts` は、ルートのファイルとルートのレイアウト（`src/app/`）だけが import する。他の slice は import しない。
- `index.ts` に部品を載せられる slice（他の slice の処理の連鎖に入らないもの）は、今までどおり 1 つの入口にする。
- `index.ts` にその理由を一行のコメントで書く。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 画面と部品は `ui/index.ts`、処理は `index.ts`（採用） | build が通る。入口が 2 つでも役割が分かれ、他の slice が見えるのは処理だけ | ADR-0014 の「入口は 1 つ」を、この場合だけ狭める |
| 全部 `index.ts` から公開し、画面を `'use client'` で包む | 入口が 1 つ | サーバー専用の画面をクライアントにできない。連鎖がクライアントに入るたびに壊れる |
| 他の slice が `db/statements.ts` を直接 import する | 連鎖が最小 | 入口を通さない決まりを破る |
| 5 つの文を `src/shared/` へ移す | 連鎖が切れる | 通知の表を shared が知ることになり、slice の境界が崩れる |

## 結果

- 他の slice のサーバー処理が使う slice でも、画面や部品を同じ slice に置ける。build と型の検査が通る。
- 入口が 2 つの slice ができる。守ること: `ui/index.ts` をルートとレイアウト以外が import しない。`index.ts` に部品を足さない。
- 他の slice が増やす場合も、同じ build のエラーが出たときに同じ形で直す。
