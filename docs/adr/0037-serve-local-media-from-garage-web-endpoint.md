---
type: ADR
title: "ADR-0037: ローカルの画像は Garage のウェブ用エンドポイント（3912）から別 origin で配信する"
description: "Garage の S3 API は匿名の GET を拒むため、ローカルの画像は読めなかった。compose に [s3_web] を足し、スロットのバケットをウェブ公開にして、S3_PUBLIC_BASE_URL と MEDIA_ORIGIN を http://insta-s<N>.web.localhost:3912 にする。ADR-0023 の有効な決定を引き継ぎ、置き換える。"
tags: [environment, parallel, docker, storage, media]
status: stable
---

# ADR-0037: ローカルの画像は Garage のウェブ用エンドポイント（3912）から別 origin で配信する

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: Director（委任された判断）
- 関連: [ADR-0021](0021-browser-made-webp-and-presigned-put.md)、[ADR-0023](0023-slots-with-garage-and-d1-files.md)（これで置き換える）、[ADR-0026](0026-csp-with-nonce-from-proxy-and-headers-file.md)、#20

## 背景

Garage の S3 API は匿名の GET を拒む（`AccessDenied: Garage does not support anonymous access yet`。#28 の実装者が報告し、Garage 自身のメッセージで確認）。そのため `S3_PUBLIC_BASE_URL`（`http://127.0.0.1:3910/<bucket>`）の画像は、実際のブラウザでは表示されず、E2E は `page.route` で画像を差し替えていた。EPIC の統合テストは実際の Chrome で行う（[ADR-0012](0012-epic-integrated-test-in-real-browser.md)）ので、これでは足りない。Garage には、ウェブサイトとして公開したバケットを匿名で読める `[s3_web]` のエンドポイントがある。ホストの 3902 番は別のプロジェクトの Garage が使っている（3900 と同じ事情）。Chrome は `*.localhost` を 127.0.0.1 に解決する。

## 決定

[ADR-0023](0023-slots-with-garage-and-d1-files.md) の次の決定を引き継ぐ。

- compose のサービスは `s3`（`dxflrs/garage:v2.5.0`、`--single-node`）だけ。DB のサービスは置かない。プロジェクト名は `name: insta-modoki`。設定は `configs.content` に埋め込み、ボリュームは `s3-meta` と `s3-data`。RPC・管理 API のポートは出さない。
- S3 API はホストの `127.0.0.1:3910`（コンテナの中は 3900）。署名付き PUT・HEAD・DELETE はここへ行う（`S3_ENDPOINT`）。
- スロットは アプリのポート `3100 + N`、バケット `insta-s<N>`、D1 は worktree の `.wrangler/state`、設定は worktree の `.dev.vars`（`.env.local` は使わない）。
- `scripts/slot.mjs <prepare|reset|drop> <N>`（N は 0〜4。終了コード 0・1・2）が、鍵 `insta-local`・バケット・`.dev.vars`・D1 のマイグレーション・バケットの CORS を整える。`docker ps` のラベルでコンテナを探し `docker exec` で `/garage` を呼ぶ。`AUTH_PEPPER` と `BETTER_AUTH_SECRET` は初回に乱数で作り、以降は保つ。
- 共有のスタックを `down`・`restart`・作り直すのは Director だけ。`compose.yaml` を変える PBI は単独の Wave にする。
- スロットの結合テスト `scripts/slot.int.test.ts` は `SLOT_INT=1` のときだけ流す。スロット 0 と 4 のバケットを空にするため、main のチェックアウトと CI だけが付け、他の worktree が使っていないスロットで流す（`SLOT_INT_A`・`SLOT_INT_B`）。

加えて、次を決める。

- `compose.yaml` の Garage の設定に `[s3_web]`（`bind_addr = "0.0.0.0:3902"`、`root_domain = ".web.localhost"`、`index = "index.html"`）を足し、ホストの `127.0.0.1:3912` に出す（コンテナの中は 3902）。
- `prepare` と `reset` は、スロットのバケットのウェブ公開を `garage bucket website --allow insta-s<N>` で許可する（何度流しても同じ）。
- `renderEnv` は `S3_PUBLIC_BASE_URL` と `MEDIA_ORIGIN` を `http://insta-s<N>.web.localhost:3912` にする。バケットはホスト名に入るので、URL にバケットの段は無い。`publicUrl` と `mediaSrcset`（`<S3_PUBLIC_BASE_URL>/<key>`）は変えない。`S3_ENDPOINT` は 3910 のまま。
- 画像の origin はアプリの origin と別にする（[ADR-0021](0021-browser-made-webp-and-presigned-put.md)、[ADR-0026](0026-csp-with-nonce-from-proxy-and-headers-file.md) の `img-src` が `MEDIA_ORIGIN` を許す）。
- 画像の origin と署名付き PUT の送り先（`S3_ENDPOINT` の origin、3910）が別になるので、CSP の `connect-src` に `MEDIA_ORIGIN` に加えて `S3_ENDPOINT` の origin を足す（`readSecurityConfig` の `uploadOrigin`）。`img-src`・`media-src` には足さない。
- E2E は画像を `page.route` で差し替えず、実際の配信元から読む。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| Garage のウェブ用エンドポイント（採用） | 匿名の GET が実際に通る。本番の R2 の公開ドメインと同じく、アプリと別の origin。バケットは既存の鍵で足りる | ポートが 1 つ増える（3912）。`*.localhost` の解決はブラウザ任せ |
| アプリの Worker が画像を中継する | 追加のポートが要らない | 本番と形が変わり、Worker の CPU とメモリを使う。同じ origin になり CSP の検証にならない |
| 他の S3 互換（MinIO）に替える | 匿名の GET をポリシーで許せる | ADR-0021 でアーカイブ済みのため却下済み |
| E2E で `page.route` の差し替えを続ける | 変更が要らない | 実際のブラウザで画像が読めることを確かめられない |

## 結果

- ローカルでも画像が実際のブラウザで表示され、E2E が `naturalWidth > 0` まで確かめられる。
- ホストの 3912 番は共有。バケット名がホスト名になるので、スロットごとに origin が分かれる。
- `compose.yaml` を変えたので、Director が共有のスタックの `s3` を作り直した（ボリュームは残る）。既存のバケットは `prepare` か `reset` でウェブ公開になる。
- ADR-0023 は置き換えた。
