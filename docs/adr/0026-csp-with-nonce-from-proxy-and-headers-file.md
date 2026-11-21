---
type: ADR
title: "ADR-0026: CSP は src/proxy.ts が要求ごとの nonce で付け、静的ファイルは public/_headers で付ける"
description: "全ての応答のセキュリティヘッダーは src/shared/security が作る。Worker を通る応答は src/proxy.ts が nonce 付きの CSP を付け、静的ファイルは public/_headers に同じヘッダー（nonce なし）を書く。nonce を使う画面は動的な描画にする。"
tags: [security, csp, nextjs]
status: stable
---

# ADR-0026: CSP は src/proxy.ts が要求ごとの nonce で付け、静的ファイルは public/_headers で付ける

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: #25、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[ADR-0018](0018-nextjs-on-workers-via-opennext.md)、[overview.md](../architecture/overview.md)

## 背景

- 企画書は CSP で外部スクリプトを禁じることを求める。Next.js は水和のためにインラインのスクリプトを出すので、`'unsafe-inline'` を許さないなら nonce が要る。
- 静的ファイル（`/_next/static/`）は Worker を通らないので、Worker のコードでは付けられない。
- `src/app/layout.tsx` は #24 の担当で、この PBI では触らない。

## 決定

- ヘッダーの値は `src/shared/security/` の `buildSecurityHeaders` だけが作る（`script-src` は `'self'` と、渡されたときの `'nonce-…'` だけ。`style-src` の `'unsafe-inline'` は React の `style` 属性のため）。
- `src/proxy.ts` が要求ごとに nonce を作り、要求のヘッダー（Next.js が読む）と応答の両方に CSP を付ける。
- 静的ファイルには `public/_headers` に nonce なしの同じ 4 つのヘッダーを書く。値が `buildSecurityHeaders` の既定とずれないよう単体テストで突き合わせる。Worker の応答には `_headers` は効かないので、CSP は 1 つだけになる。
- nonce を使う画面は動的な描画にする（`await connection()`）。静的に作った HTML にはその要求の nonce が入らないため。
- `MEDIA_ORIGIN` は origin だけを通し、`;`・空白・制御文字は URL の解釈の前に拒む（CSP に指令を差し込ませない）。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| `'self'` と要求ごとの nonce（採用） | 外部の origin を許さない。`'unsafe-inline'` なし | 画面が動的な描画になり CPU 時間が増える |
| `'unsafe-inline'` を許す | 静的な描画のまま | XSS の防御にならない |
| ハッシュ（`sha256-…`）を使う | 静的な描画のまま | Next.js のインラインの中身は版ごとに変わり、保守できない |

## 結果

- 全ての応答に 4 つのヘッダーが付き、差し込まれたインラインと外部のスクリプトは動かない（E2E で確かめた）。
- 受け入れるコスト: nonce を使う画面ごとに `await connection()` が要る。`proxy.ts` は OpenNext では実験的（#18）。
- 守ること: ヘッダーを足す・変えるときは `buildSecurityHeaders` と `public/_headers` を同時に変える。
