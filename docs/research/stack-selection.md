---
type: Research
title: 技術スタックの選定の調査
description: Cloudflare の無料枠で動かす前提で、アプリのフレームワーク・DB・ORM・認証・UI・テスト・ランタイムとパッケージ管理・画像の配信を一次情報と動く試作で比べた結果。2026-11-21 時点。決定は ADR-0018 から ADR-0022。
tags: [research, stack, cloudflare]
status: stable
---

# 技術スタックの選定の調査

2026-11-21 時点の調査（#18）。一次情報は公式の文書と、公式の release・changelog のページだけで、全ての行に URL と `確認日:` を付ける。版は、確認日の 2 週間以上前（2026-11-07 以前）に公開されたもののうち最新の安定版を使う。選ぶ順序は、① 試作が Workers のローカルの実行環境（workerd）で動く、② 無料枠の上限に収まる、③ [ADR-0014](../adr/0014-code-in-feature-slices.md) の slice の構成を壊さない、④ ここまでが同じなら企画書の第一案（Next.js・Drizzle・Better Auth）に近い方。決定は [決定の一覧](#決定の一覧) と ADR-0018 から ADR-0022 に書く。

# 比較

表の「一次情報」の列は、その行の主張の出典と確認日。「版」は npm レジストリの公開日（`npm view <package> time`）で確かめた。

## アプリのフレームワーク

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Next.js を OpenNext で載せる | next 16.4.5（2026-11-03）、@opennextjs/cloudflare 1.20.16（2026-11-03） | Next.js 16 の全ての minor と patch に対応。Node.js ランタイムで動かす。App Router・Server Actions・middleware に対応。Node.js の middleware（Next.js 16 の `proxy.ts`）は 1.20.3 から実験的。Cloudflare は新規の Next.js には vinext を勧め、OpenNext は既存のアプリ向けに保つと書く | https://opennext.js.org/cloudflare 、https://developers.cloudflare.com/workers/framework-guides/web-apps/opennext/ 確認日: 2026-11-21 |
| React Router（framework mode） | react-router 8.5.1（2026-10-27） | Cloudflare の Vite プラグインで Workers の実行環境の中で動き、バインディングはローカルで模される。ローダーとアクションは `context.cloudflare.env` から使う。SPA モードは使えない | https://developers.cloudflare.com/workers/framework-guides/web-apps/react-router/ 確認日: 2026-11-21 |
| TanStack Start | @tanstack/react-start 1.169.4（2026-10-22） | 公式の文書が "TanStack Start is stable" と書く。Cloudflare の Vite プラグインで Workers に載せ、バインディングは `cloudflare:workers` の `env` から使う | https://developers.cloudflare.com/workers/framework-guides/web-apps/tanstack-start/ 、https://tanstack.com/start/latest/docs/framework/react/overview 確認日: 2026-11-21 |
| vinext（参考。候補には数えない） | – | Cloudflare が新規の Next.js に勧める道。この PBI では試作していない | https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ 確認日: 2026-11-21 |

## DB

| 候補 | 要点 | 一次情報 |
|---|---|---|
| D1（SQLite） | Cloudflare の中で完結する。無料枠は 1 DB 500 MB・アカウントで 5 GB・10 DB。ローカルは wrangler がファイルに持つ。対話的なトランザクションは文書に無く、`batch()` が 1 つの SQL トランザクションとして動く | https://developers.cloudflare.com/d1/platform/limits/ 、https://developers.cloudflare.com/d1/worker-api/d1-database/ 、https://developers.cloudflare.com/d1/best-practices/local-development/ 確認日: 2026-11-21 |
| PostgreSQL + Hyperdrive | Hyperdrive は無料の Workers プランでも使える（1 日 100,000 クエリ）。PostgreSQL 本体は Cloudflare の外に要る。ローカルは `localConnectionString` で直接つなぐ（プールとキャッシュは効かない）。1 つの設定あたり約 20 本の接続 | https://developers.cloudflare.com/hyperdrive/platform/pricing/ 、https://developers.cloudflare.com/hyperdrive/platform/limits/ 、https://developers.cloudflare.com/hyperdrive/configuration/local-development/ 確認日: 2026-11-21 |

## ORM

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Drizzle ORM | drizzle-orm 0.45.4（2026-10-08、`latest`）、drizzle-kit 0.31.11 | `drizzle(env.DB)` で D1 のバインディングをそのまま渡す。`all` / `get` / `values` / `run` と batch API。v1 は `rc` のタグ（1.0.0-rc.6）で、D1 の文書は `@rc` を入れる手順を書くが、安定版の `latest` は 0.45.4 | https://orm.drizzle.team/docs/connect-cloudflare-d1 確認日: 2026-11-21 |
| Prisma | prisma 8.0.0-rc.34（`latest` ではない）、@prisma/adapter-d1 7.10.1 | D1 への対応は Preview。`sqlite` プロバイダーと `@prisma/adapter-d1` を使う。D1 はトランザクションに対応せず、Prisma のトランザクションは個別のクエリになる（ACID にならない） | https://www.prisma.io/docs/orm/overview/databases/cloudflare-d1 確認日: 2026-11-21 |
| Kysely | kysely 0.28.19（2026-11-01） | 公式の dialect は PostgreSQL・MySQL・MSSQL・SQLite・PGlite。D1 は「コミュニティの dialect」で第三者の kysely-d1（最新版 0.4.0 は 2025-04-19） | https://kysely.dev/docs/dialects 確認日: 2026-11-21 |

## 認証

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Better Auth | better-auth 1.7.18（2026-11-05） | Next.js では `/api/auth/[...all]` にハンドラーを置く。パスワードは既定で scrypt。`emailAndPassword.password` に `hash` と `verify` を渡して差し替えられる。スクリプトからは `auth.api.signUpEmail({ body })` でユーザーとパスワードを作れる。パスワードは `account` テーブルの `providerId = credential` の行に持つ | https://www.better-auth.com/docs/integrations/next 、https://www.better-auth.com/docs/authentication/email-password 確認日: 2026-11-21 |
| Auth.js | next-auth 4.24.15（2026-07-20） | Credentials プロバイダーは既定ではデータを DB に持たない。公式はパスワードより OAuth・メールのリンク・Passkey を勧めるが、プロバイダーを消す予定は無いと書く | https://authjs.dev/getting-started/authentication/credentials 確認日: 2026-11-21 |
| Web Crypto での自前 | – | Workers は Web Crypto の全ての操作に対応し、PBKDF2 の `deriveBits` が使える。反復の上限は文書に無いので試作で確かめる。セッション・Cookie・CSRF・レート制限は全て自作になる | https://developers.cloudflare.com/workers/runtime-apis/web-crypto/ 確認日: 2026-11-21 |

## UI

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Tailwind CSS | tailwindcss 4.3.5（2026-11-06） | Next.js は `tailwindcss` と `@tailwindcss/postcss` と `postcss.config.mjs` で組み込む。Next.js の文書は「ほとんどのスタイルに Tailwind を使い、足りないときに CSS Modules を使う」と勧める | https://tailwindcss.com/docs/installation/framework-guides/nextjs 、https://nextjs.org/docs/app/getting-started/css 確認日: 2026-11-21 |
| Radix UI Primitives | @radix-ui/react-dialog 1.3.1（2026-10-12） | スタイルの無い低レベルの部品で、WAI-ARIA に沿い、フォーカスの管理とキーボード操作を扱う。モーダル・メニュー・ツールチップなどに使える | https://www.radix-ui.com/primitives/docs/overview/introduction 確認日: 2026-11-21 |
| CSS Modules | Next.js に組み込み | `*.module.css` でクラス名をスコープする。追加の依存は無い。部品の振る舞い（フォーカスの管理など）は自作になる | https://nextjs.org/docs/app/getting-started/css 確認日: 2026-11-21 |

## テスト

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Vitest | vitest 5.1.0（2026-11-02） | 要件は Vite 6.4.0 以上と Node.js 22.12.0 以上。既存の Vite の設定を読む。Workers の実行環境の中のテストは `@cloudflare/vitest-plugin`（1.6.0、2026-11-05）を Cloudflare が勧め、`@cloudflare/vitest-pool-workers` からの移行の案内がある | https://vitest.dev/guide/ 、https://developers.cloudflare.com/workers/testing/vitest-integration/ 確認日: 2026-11-21 |
| Playwright | @playwright/test 1.65.0（2026-11-05） | 要件は Node.js の 22・24・26 の最新。`npm init playwright` などで導入 | https://playwright.dev/docs/intro 確認日: 2026-11-21 |
| Jest | jest 30.5.2（2026-09-18） | TypeScript には Babel の preset か ts-jest が要り、Babel は型を検査しない。文書の例は CommonJS で、ESM の記述は無い | https://jestjs.io/docs/getting-started 確認日: 2026-11-21 |

## ランタイムとパッケージ管理

| 候補 | 版 | 要点 | 一次情報 |
|---|---|---|---|
| Node.js 26（LTS） | 26.13.1（Latest LTS と表示） | リリースの表は v26・v24・v22 を LTS、v27 を Alpha、v25 を EOL とする。Playwright は 22・24・26、pnpm 12 は 18・20・22・24・26 に対応 | https://nodejs.org/en/about/previous-releases 確認日: 2026-11-21 |
| pnpm | pnpm 12.18.0（2026-11-05） | 12 は Node.js 18 から 26 で動く。CI では `--frozen-lockfile` が既定で有効。依存のビルドスクリプトは承認制で、承認は `pnpm-workspace.yaml` の `allowBuilds` に書く（試作で esbuild と workerd が止まった） | https://pnpm.io/installation 、https://pnpm.io/cli/install 確認日: 2026-11-21 |
| npm | Node.js に同梱 | `npm ci` は `package-lock.json` が要り、ずれていればエラーにし、`node_modules` を消してから入れる | https://docs.npmjs.com/cli/v11/commands/npm-ci 確認日: 2026-11-21 |
| bun | – | 実行環境・パッケージマネージャー・テストランナーなどを 1 つの実行ファイルにまとめる。Workers と wrangler に触れる記述は無い | https://bun.sh/docs/installation 確認日: 2026-11-21 |
| ESLint と Prettier（`lint` と `format:check` 用） | eslint 10.14.0（2026-10-30）、prettier 3.9.10（2026-10-10） | ESLint 10 は `eslint.config.js` の flat config。Prettier は `prettier . --check` を CI に勧める | https://eslint.org/docs/latest/use/getting-started 、https://prettier.io/docs/install 確認日: 2026-11-21 |
| Biome（`lint` と `format:check` の代替） | @biomejs/biome 2.6.6（2026-11-06） | フォーマッターとリンターを 1 つにし、`biome check` で両方を確かめる。React と Next.js のルールには文書が触れない | https://biomejs.dev/guides/getting-started/ 確認日: 2026-11-21 |

## 画像の配信

| 候補 | 要点 | 一次情報 |
|---|---|---|
| ブラウザで作る 3 幅の WebP と、署名付き PUT で R2 に直接置く | `canvas.toBlob(cb, "image/webp", q)` で作る。非対応のブラウザは PNG になるので `blob.type` を確かめる。R2 は GET・HEAD・PUT・DELETE の署名付き URL に対応し（POST は不可）、期限は 1 秒から 7 日。ブラウザからの PUT には CORS の設定が要り、署名付き URL は独自ドメインでは使えない。Content-Type は署名に含められ（aws4fetch は `allHeaders: true` が要る）、違う値の PUT は `403 / SignatureDoesNotMatch` になる。Content-Length を縛る記述は無い。Workers の R2 バインディングは署名付き URL を作れないので、署名には `aws4fetch`（または AWS SDK）を使う | https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob 、https://developers.cloudflare.com/r2/api/s3/presigned-urls/ 確認日: 2026-11-21 |
| Cloudflare の変換サービス（Images transformations） | 無料のプランで 1 か月に一意の変換 5,000 件まで。超えた新しい変換は `9422` のエラーになり、課金は無い。使うにはゾーンで有効にする。同じゾーンの画像が既定の元になる | https://developers.cloudflare.com/images/pricing/ 、https://developers.cloudflare.com/images/transform-images/ 確認日: 2026-11-21 |

## ローカルの S3 互換ストレージ

R2 の代わりにローカルで使う S3 互換のサーバー。ADR-0021 の決定に使う。

| 候補 | 要点 | 一次情報 |
|---|---|---|
| MinIO | リポジトリは 2026-04-25 にアーカイブされ、"NO LONGER MAINTAINED"。コミュニティ版はソースのみの配布で、ビルド済みのバイナリは出さない | https://github.com/minio/minio 確認日: 2026-11-21 |
| Garage | `dxflrs/garage:v2.5.0` が `--single-node --default-bucket` と環境変数 `GARAGE_DEFAULT_ACCESS_KEY` などで 1 つのコンテナで動く。ACL とポリシーは未対応 | https://garagehq.deuxfleurs.fr/documentation/quick-start/ 確認日: 2026-11-21 |

# Cloudflare の無料枠

Workers の無料のプラン（Workers Free）の数字。上限は 2026-11-21 の文書による。

| 項目 | 上限 | 一次情報 |
|---|---|---|
| Workers のリクエスト数 | 1 日 100,000（UTC の 0 時にリセット。超えるとエラー 1027） | https://developers.cloudflare.com/workers/platform/limits/ 確認日: 2026-11-21 |
| Workers の 1 リクエストの CPU 時間 | 10 ms（有料は 5 分） | https://developers.cloudflare.com/workers/platform/limits/ 確認日: 2026-11-21 |
| Workers のスクリプトの大きさ | 展開後 64 MiB。圧縮後の上限は無い（文書は "The gzip value is shown for reference but is not a limit" と書く）。ただし OpenNext の文書は無料のプランを圧縮後 3 MiB と書き、2 つの文書が食い違うので、両方の数字で測る | https://developers.cloudflare.com/workers/platform/limits/ 、https://opennext.js.org/cloudflare 確認日: 2026-11-21 |
| Workers のサブリクエスト数 | 1 リクエストあたり 50（内部サービスへは別に 1,000） | https://developers.cloudflare.com/workers/platform/limits/ 確認日: 2026-11-21 |
| Workers のメモリ | 1 isolate あたり 128 MB。Workers は 1 アカウントに 100 | https://developers.cloudflare.com/workers/platform/limits/ 確認日: 2026-11-21 |
| D1 の容量 | 1 DB 500 MB、アカウントで 5 GB、10 DB | https://developers.cloudflare.com/d1/platform/limits/ 確認日: 2026-11-21 |
| D1 の 1 日の読み書きの行数 | 読み 5,000,000 行 / 日、書き 100,000 行 / 日 | https://developers.cloudflare.com/d1/platform/pricing/ 確認日: 2026-11-21 |
| D1 の 1 回の呼び出しのクエリ数 | 50（無料） | https://developers.cloudflare.com/d1/platform/limits/ 確認日: 2026-11-21 |
| R2 の容量 | 10 GB-month（Standard のみ） | https://developers.cloudflare.com/r2/pricing/ 確認日: 2026-11-21 |
| R2 の操作の回数 | Class A（書き込みなど）が 1 か月 1,000,000 回、Class B（読み取りなど）が 1 か月 10,000,000 回 | https://developers.cloudflare.com/r2/pricing/ 確認日: 2026-11-21 |
| R2 の下りの転送 | 無料 | https://developers.cloudflare.com/r2/pricing/ 確認日: 2026-11-21 |
| Hyperdrive のクエリ数 | 1 日 100,000（無料のプランでも使える。超えるとエラー） | https://developers.cloudflare.com/hyperdrive/platform/pricing/ 確認日: 2026-11-21 |
| Hyperdrive の設定と接続 | 1 アカウント 10 設定、1 設定あたり約 20 の接続、1 つのクエリは最長 60 秒 | https://developers.cloudflare.com/hyperdrive/platform/limits/ 確認日: 2026-11-21 |

# 試作の記録

使い捨ての試作（リポジトリには入れない。`$TMPDIR/stack-spike/`）で、選んだ組み合わせが Workers の実行環境（workerd）で動くかを 2026-11-21 に確かめた。構成は、Next.js 16.4.5 + @opennextjs/cloudflare 1.20.16 + wrangler 4.158.0 + Drizzle ORM 0.45.4 + Better Auth 1.7.18 + D1（ローカル）+ aws4fetch 1.0.20。Node.js は 26.12.0、パッケージ管理は pnpm 12.18.0。ポートは 3001。最初に Next.js + OpenNext で試し、全ての項目が動いたので、他のフレームワークの試作には進んでいない（選ぶ順序の ①）。ログは要点だけ貼り、秘密の値は `<redacted>` にした。

## 準備でわかったこと

- `pnpm install` は、esbuild と workerd のビルドスクリプトが承認されておらず `ERR_PNPM_IGNORED_BUILDS` で止まる。`pnpm approve-builds --all` が `pnpm-workspace.yaml` に `allowBuilds: { esbuild: true, workerd: true }` を書き、再実行で通る。
- OpenNext は内部で `pnpm build` を呼ぶ。`package.json` の `build` を `opennextjs-cloudflare build` にすると自分自身を呼び続けて終わらない。`open-next.config.ts` に `buildCommand: "pnpm exec next build"` を書くと、`build` を `opennextjs-cloudflare build`、`start` を `opennextjs-cloudflare preview --port <port>` にできる（最後のビルドで確認）。
- `next build` の型の検査は、`wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts` で作る型が無いと `Property 'DB' does not exist on type 'CloudflareEnv'` で落ちる。
- ローカルの D1 は `wrangler d1 migrations apply DB --local` で `.wrangler/state` に作られ、`opennextjs-cloudflare preview` と `getPlatformProxy()` が同じファイルを使う。

## AC-4: `/` と `POST /spike/db`

```
$ curl -i localhost:3001/
HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8
x-opennext: 1
x-powered-by: Next.js

$ curl -i -X POST localhost:3001/spike/db
HTTP/1.1 200 OK
Content-Type: application/json
x-opennext: 1

{"ok":true,"row":{"id":"cab1b37b-ebb7-4f2c-b365-5e1661205bf6","name":"spike","email":"spike-cab1b37b-ebb7-4f2c-b365-5e1661205bf6@example.test","emailVerified":false,"image":null,"createdAt":"2026-11-21T01:14:25.581Z","updatedAt":"2026-11-21T01:14:25.581Z"}}
```

`users` への挿入と読み戻しは Drizzle（`db.insert(...)` と `db.select().get()`）で行い、`createdAt` は `integer({ mode: "timestamp_ms" })` が `Date` に戻した。

## AC-5: サインアップ、ログアウト、ログイン、保護したページ

保護したページは、セッションが無ければ `/accounts/login` へ 302 を返すルートハンドラー（`/spike/protected`）。Better Auth の POST は `Origin` の検査があるので `Origin` を付けた。

```
$ curl -i localhost:3001/spike/protected          # ログイン前
HTTP/1.1 302 Found
Location: /accounts/login

$ curl -i -c jar -b jar -X POST localhost:3001/api/auth/sign-up/email   # name, email, password
HTTP/1.1 200 OK
Set-Cookie: better-auth.session_token=<redacted>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax

$ curl -i -c jar -b jar localhost:3001/spike/protected   # サインアップ後
HTTP/1.1 200 OK
{"ok":true,"user":"alice@example.test"}

$ curl -i -c jar -b jar -X POST localhost:3001/api/auth/sign-out
HTTP/1.1 200 OK
{"success":true}

$ curl -i -c jar -b jar localhost:3001/spike/protected   # ログアウト後
HTTP/1.1 302 Found
Location: /accounts/login

$ curl -i -c jar -b jar -X POST localhost:3001/api/auth/sign-in/email
HTTP/1.1 200 OK
Set-Cookie: better-auth.session_token=<redacted>; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax

$ curl -i -c jar -b jar localhost:3001/spike/protected   # ログイン後
HTTP/1.1 200 OK
{"ok":true,"user":"alice@example.test"}

$ curl -X POST localhost:3001/api/auth/sign-in/email     # 違うパスワード
401
```

### パスワードのハッシュの CPU 時間

Workers の実行環境では `Date.now()` と `performance.now()` が実行中に進まないので、コードの中では測れない。代わりに、同じ `POST /spike/hash?alg=<名前>` を逐次に 10 回流し、`curl` の `time_total` の中央値と、50 回流す間に workerd のプロセスが使った CPU 時間（`ps -o time`、10 ms の分解能）を測った。`none` は何もしない同じルートで、1 リクエストの基準になる。ハッシュだけの時間は、`none` との差で見る。

```
alg=none    median wall 4.2 ms   workerd CPU 4 ms/request
alg=pbkdf2  median wall 11.2 ms  workerd CPU 11 ms/request   -> ハッシュだけ約 7 ms
alg=scrypt  median wall 41.5 ms  workerd CPU 40 ms/request   -> ハッシュだけ約 37 ms
```

`pbkdf2` は Web Crypto の PBKDF2-SHA256、反復 100,000 回。`scrypt` は Better Auth の既定。比較として Node.js 26.12.0 の `process.cpuUsage()` で 10 回測った CPU 時間の中央値は、PBKDF2-SHA256 100,000 回が 9.7 ms、Better Auth の既定の scrypt が 51.1 ms。

AC-2 の 1 リクエストの CPU 時間の上限は 10 ms。ハッシュだけの中央値は PBKDF2 が約 7 ms（workerd）と 9.7 ms（Node.js）で上限より小さく、scrypt は 37 ms 以上で上限を超える。ただし、サインアップとログインのリクエスト全体（基準 4 ms + ハッシュ 7 ms）は約 11 ms で、ローカルでは上限に届く。本番の CPU 時間は Cloudflare の計測で違う可能性があり、M2 のデプロイで測り直す（ADR-0020）。

## AC-6: 署名付き PUT

署名は Worker の `GET /spike/presign` が aws4fetch で作る（`X-Amz-Expires=300`、`signQuery`）。S3 互換のローカルのストレージは、試作では MinIO のコンテナ `insta-spike-s3`（ポート 59000）。

```
$ curl "localhost:3001/spike/presign?key=spike/1x1.png&method=PUT&expires=300"
{"url":"http://localhost:59000/insta-spike/spike/1x1.png?X-Amz-Expires=300&X-Amz-Date=20261121T011511Z&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=<redacted>&X-Amz-SignedHeaders=host&X-Amz-Signature=<redacted>","method":"PUT","expires":300}

$ curl -X PUT --data-binary @1x1.png <url>
HTTP 200
$ curl <署名付きの GET の URL> -o got.png
HTTP 200
$ cmp 1x1.png got.png
cmp exit=0
$ curl -X PUT <署名を 1 文字変えた URL>
HTTP 403
```

期限の確認（5 分の URL を 6 分後に使う）:

```
issued at 10:15:06 (X-Amz-Expires=300)
used at 10:21:06 (6 min later)
PUT after 6 min => HTTP 403
PUT with fresh URL (control) => HTTP 200
```

### Content-Type と長さを署名に含める（レビューの指摘への対応）

最初の署名は `X-Amz-SignedHeaders=host` だけで、型も大きさも縛れなかった（公開のバケットから HTML や SVG を配信できてしまう）。aws4fetch は `content-type` と `content-length` を既定で署名から外すので、`{ aws: { signQuery: true, allHeaders: true } }` で署名に含め、`content-type: image/webp` と宣言した `content-length` を付けて署名した。署名のヘッダーは `content-length;content-type;host` になり、署名と違う PUT は 403 で止まった（MinIO と Garage で同じ結果。R2 はローカルで試せず、Content-Type を縛れることは文書で確認、Content-Length は文書に記述が無い）。

```
== MinIO (signed: content-type=image/webp, content-length=70)
X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost
PUT Content-Type: image/webp, 1x1.png (control)         => HTTP 200
PUT Content-Type: text/html, evil.html                   => HTTP 403
PUT Content-Type: image/webp, different length body       => HTTP 403
content-type signed only, text/html sent                  => HTTP 403
content-type signed only, image/webp, large body          => HTTP 200
== Garage (signed: content-type=image/webp, content-length=70)
X-Amz-SignedHeaders=content-length%3Bcontent-type%3Bhost
PUT Content-Type: image/webp, 1x1.png (control)         => HTTP 200
PUT Content-Type: text/html, evil.html                   => HTTP 403
PUT Content-Type: image/webp, different length body       => HTTP 403
content-type signed only, text/html sent                  => HTTP 403
content-type signed only, image/webp, large body          => HTTP 200
```

Content-Type だけを署名した URL は、大きな本体を `image/webp` として送ると通る。大きさは、署名に含められる場合も、R2 で縛れるかを確かめていないので、サーバーが `HEAD` で確かめる（ADR-0021）。なお、署名した型は `image/webp` という宣言で、中身が WebP かは縛れない。

MinIO はアーカイブされているので（比較の表）、compose に入れる候補の Garage v2.5.0（コンテナ `insta-spike-garage`、`s3_region = "auto"`）でも同じ署名で確かめた。

```
PUT => HTTP 200
GET => HTTP 200
cmp exit=0
PUT with X-Amz-Expires=2 used after 4 s => HTTP 400
```

Garage は期限切れに 400 を返す（MinIO と R2 の文書上の挙動は 403）。アプリのテストはストレージが返す期限切れのコードに依存させない。

## AC-7: ビルドの成果物の大きさ

```
$ wrangler deploy --dry-run --outdir dist-dry        # 最初のビルド（ルート 6 本）
Total Upload: 6914.16 KiB / gzip: 1461.68 KiB
$ wrangler deploy --dry-run --outdir dist-dry        # 最後のビルド（proxy.ts と 9 本のルート）
Total Upload: 8049.81 KiB / gzip: 1713.11 KiB
```

最後のビルドで gzip 後は 1,713 KiB（約 1.67 MiB）。AC-2 のスクリプトの大きさの上限は、Workers の文書では展開後 64 MiB（圧縮後の上限は無い）で、OpenNext の文書の圧縮後 3 MiB（3,072 KiB）よりも小さい。どちらの数字にも収まるが、試作は画面が無いので、実際のアプリでは大きくなる。M2 のデプロイで測り直す。

## 追加で確かめたこと（後続の PBI の確定表のため）

- **D1 のトランザクション**: `POST /spike/batch` は 1 つ目の `insert` の後に重複するメールの `insert` を同じ `db.batch([...])` に入れ、全体が戻ることを確かめた。`POST /spike/tx` の `db.transaction(...)` は D1 では使えない。

```
$ curl -X POST localhost:3001/spike/batch
{"batchError":"D1_ERROR: UNIQUE constraint failed: users.email: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)","rowsAfterFailedBatch":0}
$ curl -X POST localhost:3001/spike/tx
{"transaction":"error","message":"Failed query: begin\nparams: "}
```

- **ミドルウェア**: Next.js 16 の `src/proxy.ts`（Node.js ランタイム）は OpenNext 1.20.16 の `build` で「Node.js middleware support is experimental」と警告されるが、workerd で動き、リクエストの前に CSP と `x-nonce` を付けられた。`await connection()` で動的にした `/spike/csp` では、Next.js 自身のスクリプトの `nonce` が自動で付いた。インラインのスクリプトは 9 本あるので、`'unsafe-inline'` を使わないなら nonce が要り、全ての画面が動的な描画になる。

```
$ curl -i localhost:3001/spike/csp
HTTP/1.1 200 OK
content-security-policy: default-src 'self'; script-src 'self' 'nonce-<random>' 'strict-dynamic'; ...
x-spike-proxy: ran
<script src="/_next/static/chunks/....js" async="" nonce="<random>"
```

- **静的ファイルのヘッダー**: `public/_headers` に書いた規則が、`public/hello.txt` と `/_next/static/*` に付く。静的ファイルは Worker を通らないので、`proxy.ts` のヘッダーは付かない。

```
$ curl -i localhost:3001/hello.txt
HTTP/1.1 200 OK
x-spike-static: yes
```

- **TypeScript のスクリプト**: Node.js 26 は型を取り除いて `.ts` をそのまま実行する。`wrangler` の `getPlatformProxy()` でバインディング（D1）と `.dev.vars` を読み、Better Auth の `auth.api.signUpEmail({ body })` でパスワード付きのユーザーを作れた。相対の import に `.ts` の拡張子が要り、`@/` の別名は使えない（`tsconfig` は `allowImportingTsExtensions: true`）。

```
$ node scripts/seed.ts
Using secrets defined in .dev.vars
seeded user: seeded-1795223730753@example.test
```

- **結合テストの DB**: `getPlatformProxy({ persist: false })` はメモリ上の D1 を返し、マイグレーションの SQL を流してから Drizzle で読み書きできた。

```
$ node scripts/inttest.ts
in-memory D1 rows: 1
```

- **1 リクエストの CPU 時間（ローカル、50 回の平均、10 ms の分解能）**: 動的に描画する画面（`GET /spike/csp`、`proxy.ts` 込み）が 8 ms、`POST /spike/db` が 6 ms、`GET /spike/protected`（セッションの検査）が 5 ms。画面が無い試作でも動的な画面は 10 ms の上限に近いので、M2 のデプロイで実測する。

## 後片付け

試作のコンテナ `insta-spike-s3` と `insta-spike-garage` は、確認の後（Content-Type の確認の後にも）に削除した。試作のコードと `.dev.vars` はリポジトリに入れていない。

# 決定の一覧

選ぶ順序（① workerd で動く ② 無料枠に収まる ③ ADR-0014 を壊さない ④ 企画書の第一案に近い）で決めた。

| 層 | 決定 | 決め手 | ADR |
|---|---|---|---|
| アプリのフレームワーク | Next.js 16（App Router）を OpenNext で Workers に載せる | ① 試作が workerd で動いた。② gzip 後 1.67 MiB で収まる。③ ルートのファイルを薄くすれば slice を壊さない。④ 企画書の第一案 | [ADR-0018](../adr/0018-nextjs-on-workers-via-opennext.md) |
| DB | Cloudflare D1（ローカルは wrangler のファイル） | ② Cloudflare の中で完結し、外部のアカウントが要らない。ローカルは compose の DB サービスが要らない | [ADR-0019](../adr/0019-d1-and-drizzle.md) |
| ORM | Drizzle ORM 0.45.4（安定版） | ① D1 を直接つなぎ、`batch()` が使える。Prisma は D1 が Preview でトランザクション無し、Kysely は D1 がコミュニティ | [ADR-0019](../adr/0019-d1-and-drizzle.md) |
| 認証 | Better Auth 1.7.18、メールとパスワード、DB のセッション、ハッシュは PBKDF2-SHA256 100,000 回に差し替え | ① 試作で動いた。② 既定の scrypt は 37 ms 以上で 10 ms を超え、PBKDF2 は約 7 ms | [ADR-0020](../adr/0020-better-auth-with-pbkdf2.md) |
| 画像の配信とストレージ | ブラウザで作る 3 幅の WebP と原本を、署名付き PUT で R2 に直接置く。変換サービスは使わない。ローカルは Garage | ② 変換サービスは 1 か月 5,000 件で足りない。`media.storage_key` は変えずに済む | [ADR-0021](../adr/0021-browser-made-webp-and-presigned-put.md) |
| UI | Tailwind CSS 4 + Radix UI Primitives。足りないときだけ CSS Modules | Next.js の文書の推奨。Radix がアクセシビリティの部品を持つ | [ADR-0022](../adr/0022-testing-ui-and-package-management.md) |
| テスト | Vitest 5（単体と結合）+ Playwright（E2E） | Jest は TypeScript に Babel か ts-jest が要る | [ADR-0022](../adr/0022-testing-ui-and-package-management.md) |
| ランタイムとパッケージ管理 | Node.js 26（LTS）+ pnpm 12 | Node.js 26 で試作が動いた。pnpm は `allowBuilds` を `pnpm-workspace.yaml` に書く | [ADR-0022](../adr/0022-testing-ui-and-package-management.md) |
| lint と format | ESLint 10 + Prettier 3 | 文書の手順が確かで、`lint` と `format:check` を分けられる | [ADR-0022](../adr/0022-testing-ui-and-package-management.md) |

[ADR-0014](../adr/0014-code-in-feature-slices.md) は、Next.js の規約（`src/app/` のルートのファイル、`src/proxy.ts`）と矛盾しない。理由は [overview.md](../architecture/overview.md) に書いた。

# 結果として残る危険

- 動的な画面の CPU 時間は、ローカルの計測で 8 ms と 10 ms の上限に近い。本番（M2）で実測し、超えるなら無料枠の方針（[ADR-0011](../adr/0011-deploy-to-cloudflare-free-tier-first.md)）を超える判断になるのでユーザーが決める。
- OpenNext の Node.js ミドルウェアの対応は実験的。
- ブラウザの `canvas.toBlob` が WebP を作れない環境では PNG になる。`blob.type` を確かめ、WebP でなければ投稿を止める。実ブラウザでの確認は、画像の投稿の PBI で行う。
- Cloudflare の文書同士が、スクリプトの大きさの上限で食い違う（圧縮後 3 MiB か、展開後 64 MiB のみか）。
