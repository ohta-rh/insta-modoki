# ドキュメントの更新履歴

## 2026-11-21
* **Creation**: [ADR-0027](adr/0027-ci-runs-verify-and-docs-check.md)（CI は 1 つの job で verify を流し、docs の検査は依存の無い `scripts/check-docs.mjs`）を追加し、[guides/verify.md](guides/verify.md) に `docs` の手順・docs の検査・CI の節を足した（#22）。
* **Creation**: [ADR-0023](adr/0023-slots-with-garage-and-d1-files.md)（compose は Garage だけ、スロットは D1 のファイル・バケット・.dev.vars）と [guides/](guides/)（[ローカル開発の手順](guides/local-development.md)）を追加し、[ADR-0008](adr/0008-share-one-compose-stack-with-a-slot-per-worktree.md) を置き換えた（#20）。
* **Creation**: [ADR-0026](adr/0026-csp-with-nonce-from-proxy-and-headers-file.md)（CSP は `src/proxy.ts` の nonce と `public/_headers`）を追加した（#25）。
* **Creation**: [architecture/design-system.md](architecture/design-system.md)（トークン・自作のロゴとアイコン・禁止語・色の使い方・画面の骨格）を追加し、[architecture/index.md](architecture/index.md) に載せた（#24）。
* **Creation**: アプリの雛形（Next.js + OpenNext、Vitest、Playwright、ESLint、Prettier）と `scripts/verify.mjs`、[guides/verify.md](guides/verify.md)、[ADR-0024](adr/0024-verify-command-and-coverage-gate.md)（verify の手順とカバレッジの基準）を追加し、[conventions.md](architecture/conventions.md) の「テスト」に `scripts/**/*.test.ts` とカバレッジの基準を足した（#19）。
* **Creation**: [research/](research/)（[技術スタックの選定の調査](research/stack-selection.md)）と [architecture/overview.md](architecture/overview.md)（全体の図・環境変数・コマンド名・ルートのファイルの場所・後続の PBI への確定表）を追加した（#18）。
* **Creation**: [ADR-0018](adr/0018-nextjs-on-workers-via-opennext.md)（Next.js を OpenNext で Workers に）、[ADR-0019](adr/0019-d1-and-drizzle.md)（D1 と Drizzle）、[ADR-0020](adr/0020-better-auth-with-pbkdf2.md)（Better Auth と PBKDF2）、[ADR-0021](adr/0021-browser-made-webp-and-presigned-put.md)（ブラウザの WebP と署名付き PUT、Garage）、[ADR-0022](adr/0022-testing-ui-and-package-management.md)（Vitest・Playwright・Tailwind・Radix・Node.js 26・pnpm 12）を追加した。
* **Update**: [ADR-0021](adr/0021-browser-made-webp-and-presigned-put.md) に署名付き PUT の型と大きさの固定・配信のオリジンの分離・`HEAD` の検査を、[ADR-0020](adr/0020-better-auth-with-pbkdf2.md) に反復の外れの承知・pepper・レート制限を足し、[routes.md](architecture/routes.md) と [conventions.md](architecture/conventions.md) を合わせた（#18 のレビューの指摘）。
* **Update**: ADR-0020 に定数時間の verify、ADR-0021 に公開配信と R2 の長さの強制の既知の限界を足した（#18 のセキュリティレビューの低の指摘）。
* **Update**: ADR-0021 にキーの所有の検査と `HEAD` の限界、ADR-0020 に IP の取り方・メール単位の制限・`Secure` Cookie、overview.md に `AUTH_PEPPER` を足した（#18 のセキュリティレビュー 2 回目の指摘）。
* **Update**: [data-model.md](architecture/data-model.md) に DB の型の対応を、[routes.md](architecture/routes.md) と [conventions.md](architecture/conventions.md) に [overview.md](architecture/overview.md) への参照を足した。
* **Creation**: [ADR-0017](adr/0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md)（M1 を統合ブランチ `m1/local-mvp` に入れ、main への PR を 1 つ出す）を追加した。
* **Creation**: [architecture/](architecture/)（[データモデル](architecture/data-model.md)・[URL とサーバーの処理](architecture/routes.md)・[実装の共通の決まり](architecture/conventions.md)）を追加した。
* **Creation**: [ADR-0015](adr/0015-pbis-follow-the-global-write-pbi-standard.md)（PBI をグローバルの write-pbi の水準で書く）と [ADR-0016](adr/0016-typescript-and-react.md)（TypeScript と React）を追加し、PBI 51 と EPIC 17 の本文を書き直した。

## 2026-11-20
* **Creation**: 企画書から GitHub の Milestone 4 つ・EPIC 17・PBI 51 を起票し、その前提として [ADR-0013](adr/0013-four-milestones-local-mvp-then-cloudflare.md)（マイルストーンの組み直し）と [ADR-0014](adr/0014-code-in-feature-slices.md)（機能の slice）を追加した。
* **Creation**: [ADR-0012](adr/0012-epic-integrated-test-in-real-browser.md)（EPIC の総合試験を実ブラウザで行う）と [test-reports/](test-reports/) を追加した。
* **Creation**: `docs/` を OKF v0.3 のバンドルとして作成した（[ADR-0002](adr/0002-docs-as-okf-v0-3-bundle.md)）。
* **Creation**: [企画書](proposal/)（PDF・HTML の原本・ビルド用スクリプト）を追加した。
* **Creation**: [ADR-0001](adr/0001-record-architecture-decisions.md) から [ADR-0011](adr/0011-deploy-to-cloudflare-free-tier-first.md) を追加した。
