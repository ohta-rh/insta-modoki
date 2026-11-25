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

レビューで、最初の署名（`X-Amz-SignedHeaders=host` だけ）は型と大きさを縛らず、公開のバケットから HTML や SVG を配信できると指摘された。aws4fetch は `content-type` と `content-length` を既定では署名しないが、`allHeaders: true` で署名でき、R2 の文書は Content-Type を署名に含められると書く（Content-Length は記述が無い）。

試作で、aws4fetch の署名付き PUT・GET が S3 互換のローカルのストレージ（MinIO と Garage v2.5.0）で動き、5 分の期限の URL を 6 分後に使うと 403（MinIO）、Garage は期限切れに 400 を返した。

## 決定

- 変換サービスは使わない。ブラウザが `canvas.toBlob(cb, "image/webp", q)` で `w320`・`w640`・`w1080`（拡大はしない）と、長辺 2,048 px の原本の WebP を作る。`blob.type` が `image/webp` でなければ投稿を止める。
- `requestUploadUrls` は、Worker が aws4fetch で署名付き PUT の URL（期限 5 分）を発行する。ブラウザが R2 に直接 PUT する。R2 のバケットには、ブラウザの PUT を許す CORS を設定する。
- 署名は `{ aws: { signQuery: true, allHeaders: true } }` で `content-type: image/webp` と、宣言した `content-length`（`variantSizes` と原本の大きさ）を含める。ブラウザは同じ `Content-Type` で送る。違う `Content-Type`（例 `text/html`）や違う長さの PUT は 403 で止まる（試作: MinIO と Garage で確認。R2 は Content-Type だけ文書で確認し、Content-Length を縛れるかは未確認なので、これには頼らない）。
- 署名では中身が WebP かを縛れないので、書き込みの後にサーバーが確かめる。`createPost` と `updateProfile`（アバター）は、参照する全てのオブジェクトを `HEAD` し、`Content-Type` が `image/webp`、実際の大きさが宣言した大きさ以下で、宣言した大きさが [conventions.md](../architecture/conventions.md) の上限（1 枚 10MB）以下でなければ `VALIDATION` で拒否する。
- 所有の検査（`HEAD` の前に行う）。`createPost` の `media[].key` と `updateProfile` の `avatarKey` は、どれも次の形で、`<userId>` がセッションの利用者の `id` と一致しなければならない。`^media/<セッションの userId>/<UUIDv7>(/(orig|w320|w640|w1080)\.webp)?$`（`media.storage_key` の基本のキーの形。基本のキーを受け取り、4 つの派生は `requestUploadUrls` が決めた名前で補う）。さらに、そのキーが他の `media` の行や他の `users.avatar_key` に既に参照されていてはならない。どれかに当てはまらなければ、何も消さずに `VALIDATION` を返す。`HEAD` の検査に落ちたときに消してよいのは、この所有の検査を通ったキーだけで、他の利用者のオブジェクトは決して消さない。
- `pending_uploads` のような発行の記録のテーブルは置かない。キーの接頭辞（利用者の `id`）と「まだ参照されていない」ことの検査で、他人のキーの参照と削除を止められ、UUIDv7 のキーは推測しにくい。記録を足すと書き込みが増え、無料枠の書き込み（1 日 100,000 行）を使う。
- `HEAD` の検査は完全性の保証ではない。検査の後も、5 分の署名付き PUT の URL が有効なら、同じキーに上書きできる。影響は、署名した `Content-Type`、アプリと分けた配信のオリジン、`nosniff` で抑える。
- どの行からも参照されないままのオブジェクト（投稿せずに離脱した、拒否した）は、`storage_orphans` を使う M3 の掃除のジョブが `media/<userId>/` の下で作成から 24 時間を過ぎ、`media`・`users.avatar_key` に無いものを消す（[conventions.md](../architecture/conventions.md) の「削除」）。
- 配信は、バケットの公開の URL から `storage_key` を足した URL で行う。署名付き URL は書き込みにだけ使う。配信のオリジンはアプリのオリジンと別にする（開発は `r2.dev` かローカルの Garage の別ポート、本番は専用のメディア用ホスト名。アプリと別の登録可能なドメインが望ましく、少なくとも別のオリジンにする）。Cookie とアプリの権限を同じオリジンで共有させない。
- 配信の応答に `X-Content-Type-Options: nosniff` を付ける（本番は R2 の独自ドメインに対する Cloudflare のルールで付ける。これは M2 で設定して確かめる。ローカルの Garage には付けられないので、アプリの側では `Content-Type` が `image/webp` のオブジェクトだけを参照する）。
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

- R2 の認証情報の作成と CORS・配信用のホスト名・`nosniff` のルールの設定は、ユーザーの操作が要る M2 で行う。
- 既知の限界: メディアは公開のバケットから、アクセスの検査なしに配信する。M4 の非公開アカウント（#66）では、非公開のアカウントのメディアを、Worker が可視性を検査して返すか、短い期限の署名付き GET で配信する。それまでは受け入れた限界で、キーが UUIDv7 で推測しにくいことに頼る。
- M2 で、R2 が署名した content-length を強制するかを確かめる。それまでは、大きさの上限は、サーバーの `HEAD` の検査と、`requestUploadUrls` の既存の利用者ごとの上限（[conventions.md](../architecture/conventions.md) の 1 時間 300 枚）に頼る。大きすぎて参照されないオブジェクトは、掃除のジョブが消すまで残る。
- [routes.md](../architecture/routes.md) の `requestUploadUrls` は、署名に型と大きさを含める。`createPost` と `updateProfile` は所有の検査と `HEAD` の検査の `VALIDATION` を返す。
- #20 は Garage のサービスと、スロットごとのバケット `insta-s<N>` の作成を足す。
- アプリのテストは、期限切れの HTTP のコードに依存させない。
