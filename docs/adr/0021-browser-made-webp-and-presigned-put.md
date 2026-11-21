---
type: ADR
title: "ADR-0021: 画像はブラウザで 3 幅の WebP を作り、署名付き PUT で R2 に直接置く。ローカルのストレージは Garage にする"
description: "変換サービス（Cloudflare Images）は使わず、ブラウザが w320・w640・w1080 の WebP と原本を作って署名付き URL で R2 に置く。署名は aws4fetch、ローカルの S3 互換ストレージは Garage v2.5.0。media.storage_key は変えない。"
tags: [architecture, media, storage]
status: stable
---

# ADR-0021: 画像はブラウザで 3 幅の WebP を作り、署名付き PUT で R2 に直接置く。ローカルのストレージは Garage にする

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: エージェント（委任された判断）
- 関連: [調査](../research/stack-selection.md)、#18、[ADR-0006](0006-first-milestone-runs-locally-on-docker-compose.md)、[ADR-0011](0011-deploy-to-cloudflare-free-tier-first.md)、[data-model.md](../architecture/data-model.md)、[routes.md](../architecture/routes.md)

## 背景

`media.storage_key` は、ブラウザが作る 3 幅の WebP（`w320`・`w640`・`w1080`）と原本（`orig.webp`）の置き場所を前提にしている。Cloudflare の変換サービスは、無料のプランで 1 か月に一意の変換 5,000 件までで、超えた新しい変換は `9422` のエラーになる。R2 の無料枠は 10 GB・Class A が 1 か月 1,000,000 回・Class B が 1 か月 10,000,000 回・下りは無料で、1 枚の画像は 4 回の PUT になる。Workers の R2 バインディングは署名付き URL を作れず、署名には S3 API の認証情報と aws4fetch が要る。署名付き URL は独自ドメインでは使えない。MinIO のリポジトリは 2026-04-25 にアーカイブされた。

試作で、aws4fetch の署名付き PUT・GET が S3 互換のローカルのストレージ（MinIO と Garage v2.5.0）で動き、5 分の期限の URL を 6 分後に使うと 403（MinIO）、Garage は期限切れに 400 を返した。

## 決定

- 変換サービスは使わない。ブラウザが `canvas.toBlob(cb, "image/webp", q)` で `w320`・`w640`・`w1080`（拡大はしない）と、長辺 2,048 px の原本の WebP を作る。`blob.type` が `image/webp` でなければ投稿を止める。
- `requestUploadUrls` は、Worker が aws4fetch で署名付き PUT の URL（期限 5 分）を発行する。ブラウザが R2 に直接 PUT する。R2 のバケットには、ブラウザの PUT を許す CORS を設定する。
- 配信は、バケットの公開の URL（開発は `r2.dev`、本番は独自ドメイン）から `storage_key` を足した URL で行う。署名付き URL は書き込みにだけ使う。
- ローカルの S3 互換ストレージは Garage（`dxflrs/garage:v2.5.0`）を compose に入れる。`s3_region = "auto"`。MinIO は使わない。
- 環境変数は `S3_ENDPOINT`・`S3_BUCKET`・`S3_ACCESS_KEY`・`S3_SECRET_KEY`・`S3_PUBLIC_BASE_URL`。
- `data-model.md` の `media.storage_key` と `routes.md` の `requestUploadUrls` は変えない。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| ブラウザで WebP を作り、署名付き PUT で R2 へ（採用） | 無料枠の変換の上限が無い。Worker の CPU 時間とリクエストの本体を使わない。既存の設計を変えない | ブラウザが WebP を作れないと投稿できない（Safari の対応は実ブラウザで確認する）。R2 の認証情報（秘密）と CORS の設定が要る |
| Cloudflare の変換サービス | サーバー側で幅と形式を選べる | 1 か月 5,000 件の一意の変換で足りず、超えると変換が失敗する。ゾーンで有効にする必要がある。`storage_key` の設計が変わる |
| Worker が R2 バインディングで受け取る | 署名と CORS が要らず、ローカルも miniflare の R2 で済む | リクエストの本体が Worker を通る。`requestUploadUrls` の設計を変える |
| ローカルのストレージに MinIO | 署名付き PUT が動き、期限切れは 403 | リポジトリがアーカイブされ、ビルド済みのバイナリは更新されない |
| ローカルのストレージに Garage（採用） | 試作で署名付き PUT・GET が動く。メンテナンスされている。1 コンテナで動く | 期限切れが 400（R2 は 403）。ACL とポリシーは未対応 |

## 結果

- R2 の認証情報の作成と CORS の設定は、ユーザーの操作が要る M2 で行う。
- #20 は Garage のサービスと、スロットごとのバケット `insta-s<N>` の作成を足す。
- アプリのテストは、期限切れの HTTP のコードに依存させない。
