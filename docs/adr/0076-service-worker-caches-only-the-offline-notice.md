---
type: ADR
title: "ADR-0076: Service Worker はオフラインの案内の画面だけをキャッシュし、ページと API の応答は保存しない"
description: "ホーム画面に追加できるようにする Service Worker（public/sw.js）は、案内の画面 1 件だけをキャッシュする。ログイン中のページや API の応答は保存しない。"
tags: [pwa, security]
status: stable
---

# ADR-0076: Service Worker はオフラインの案内の画面だけをキャッシュし、ページと API の応答は保存しない

- ステータス: 採用
- 日付: 2026-11-26
- 決定者: エージェント（委任された判断。#52）
- 関連: [ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md) / [ADR-0026](0026-csp-with-nonce-from-proxy-and-headers-file.md) / #52

## 背景

- 企画書の機能 15 は、ホーム画面に追加でき、オフラインのときは案内が出ることを求める。ブラウザが「インストール可能」と判定するには、Web App Manifest と `fetch` を扱う Service Worker が要る。
- このアプリのページはログイン中の本人の内容（フィード、通知、DM）を含む。Service Worker が応答を保存すると、端末を共有する別の人や、ログアウト後に、前の人の内容が出うる。
- CSP は `script-src 'self'` で、インラインのスクリプトは動かない。`public/` は Workers Static Assets が配り、`public/_headers` がヘッダーを付ける。

## 決定

- `public/sw.js` は `offline-v1` の中に `/assets/offline.html` の 1 件だけを入れる。ページ・API・画像・スクリプトの応答は保存しない。`cache.put` は 1 回だけ、`/assets/offline.html` のために使う。Workers Static Assets がこのパスをリダイレクトし、`redirected` の応答はナビゲーションの応答に使えないため、同じ本文とヘッダーの新しい `Response`（`redirected` でない）を入れる。`addAll` は使わず、ほかの応答は一切保存しない。
- `fetch` はナビゲーションのときだけ `respondWith` し、サーバーの応答（500・404 を含む）はそのまま返す。通信の失敗のときだけ案内の画面を返す。
- `activate` で `offline-v1` 以外の名前のキャッシュを全て消し、`skipWaiting` と `clients.claim` で新しい版をすぐ効かせる。`sw.js` は `Cache-Control: no-cache` で配る。
- 案内の画面は 1 ファイルで完結し、「再読み込み」は JS を使わない `<form action="/">` にする。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 全てのページをキャッシュ | オフラインでも閲覧できる | 古い内容や他人の内容が出る。ログアウトで消す仕組みが要る |
| 静的な資源だけをキャッシュ | 速くなる | 版の食い違いの面倒が増える。目的（インストール可能・案内）に要らない |
| 案内の画面だけ（採用） | 他人の内容が出る道が無い。小さく、試せる | オフラインで閲覧はできない |

## 結果

- ログイン中の内容が端末のキャッシュに残らない。`caches` の中身が 1 件であることを E2E と単体テストで確かめる。
- オフラインでの閲覧は対象外。要るなら、保存する対象と消す条件を決める新しい ADR で置き換える。
- キャッシュの名前を変えるとき（`offline-v2`）は、`activate` が古い名前を消す。
