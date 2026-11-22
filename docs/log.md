# ドキュメントの更新履歴

## 2026-11-22
* **Update**: [data-model.md](architecture/data-model.md)（`stories`・`story_views` の列・制約・索引を `migrations/0007_stories.sql` のとおりに）、[routes.md](architecture/routes.md)（`requestStoryUpload`・`createStory`）、[conventions.md](architecture/conventions.md)（ストーリーの上限）、[overview.md](architecture/overview.md)（`/stories/create`）を更新した（#47）。
* **Creation**: [ADR-0052](adr/0052-phase-2-before-cloudflare-publication.md)（マイルストーンの順番を M1 → M3 → M2 → M4 に変える）を追加し、[ADR-0013](adr/0013-four-milestones-local-mvp-then-cloudflare.md) を置き換えにした。
* **Creation**: [EPIC #5 の総合試験のレポート（2 回目）](test-reports/epic-0005-follow-feed-r2.md)（PASS。ADR-0048 によるやり直しで、リファクタ 52a1ddb..836c2e6 の後も 7 つの AC が満たされ、フィード 48 件・フォロー中一覧 100 件のページ送りに重複・抜けは無く、JS 無しのフォームの動きも変わらない）と、その写真・記録（`test-reports/evidence/epic-0005-r2/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #4 の総合試験のレポート（3 回目）](test-reports/epic-0004-post-create-detail-r3.md)（PASS。ADR-0048 によるやり直しで、リファクタ 52a1ddb..836c2e6 の後も 6 つの AC が満たされた。削除の失敗後に focus が一度 body に落ちる軽微な挙動を記録）と、その写真・記録（`test-reports/evidence/epic-0004-r3/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #3 の総合試験のレポート（2 回目）](test-reports/epic-0003-profile-r2.md)（PASS。ADR-0048 によるやり直しで、リファクタ 52a1ddb..836c2e6 の後も 5 つの AC が満たされ、28 件のグリッドの無限スクロールに重複・抜けは無い）と、その写真・記録（`test-reports/evidence/epic-0003-r2/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #2 の総合試験のレポート（2 回目）](test-reports/epic-0002-account-signup-login-r2.md)（PASS。ADR-0048 によるやり直しで、リファクタ 52a1ddb..836c2e6 の後も 5 つの AC が満たされ、ログアウト後に古いセッションは残らない）と、その写真・記録（`test-reports/evidence/epic-0002-r2/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [ADR-0048](adr/0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md)（確かめた AC はその場で issue のチェックを付け、PASS した EPIC の画面に後から触れたら総合試験をやり直す）を追加した。
* **Creation**: [EPIC #7 の総合試験のレポート](test-reports/epic-0007-mvp-quality.md)（1 回目、PASS）と、その写真・記録（`test-reports/evidence/epic-0007/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #5 の総合試験のレポート](test-reports/epic-0005-follow-feed.md)（1 回目、PASS）と、その写真・記録（`test-reports/evidence/epic-0005/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Update**: [design-system.md](architecture/design-system.md) に「アクセシビリティ」の節（検査の一覧と、直した違反の規則・画面・箇所）を足した（#46）。
* **Creation**: [EPIC #4 の総合試験のレポート（2 回目）](test-reports/epic-0004-post-create-detail-r2.md)（PASS。#74 の修正で「削除」の警告が消えた。「いいねした人」の一覧を開く手順を足した）と、その写真・記録（`test-reports/evidence/epic-0004-r2/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #6 の総合試験のレポート](test-reports/epic-0006-reactions-like-comment.md)（1 回目、PASS）と、その写真・記録（`test-reports/evidence/epic-0006/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。

## 2026-11-21
* **Creation**: [性能の計測のレポート](test-reports/perf-2026-11-21.md)（#45。全ての基準以内。初期 JS を 183,451 → 150,208 バイトに修正）と [ADR-0046](adr/0046-performance-budget-in-verify-and-ci.md)（性能の基準を `THRESHOLDS` に定め、初期 JS は verify の `perf-budget`、他は `--with-perf` と CI の `perf` の job で検査する）を追加し、[verify.md](guides/verify.md) に新しい手順を載せた。
* **Creation**: [EPIC #4 の総合試験のレポート](test-reports/epic-0004-post-create-detail.md)（1 回目、FAIL。投稿詳細の「削除」でコンソールに警告 1 件）と、その写真・記録（`test-reports/evidence/epic-0004/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #3 の総合試験のレポート](test-reports/epic-0003-profile.md)（1 回目、PASS。ヘッダーのアイコンの `alt=""` は隣に名前がある飾りとして正しい、と Director が判定）と、その写真・記録（`test-reports/evidence/epic-0003/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [EPIC #1 の総合試験のレポート（2 回目）](test-reports/epic-0001-dev-foundation-r2.md)（PASS。#72 の修正で AC-6 が満たされた）と、その写真・記録（`test-reports/evidence/epic-0001-r2/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [ADR-0043](adr/0043-profile-grid-modal-by-intercepting-route.md)（プロフィールのグリッドからのモーダルは intercepting routes と parallel routes）を追加し、[routes.md](architecture/routes.md) に載せた（#41）。
* **Creation**: [EPIC #2 の総合試験のレポート](test-reports/epic-0002-account-signup-login.md)（1 回目、PASS。AC-4 の Secure は ADR-0030 により https のときだけで、結合テストで確かめた）と、その写真・記録（`test-reports/evidence/epic-0002/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Creation**: [ADR-0045](adr/0045-epic-test-may-drive-headed-chrome-over-cdp.md)（chrome-devtools の MCP が使えないとき、epic-tester は画面ありの Google Chrome を CDP で操作して総合試験を行う。EPIC #1 の総合試験で MCP のプロファイルが別のセッションに握られていた）を追加し、`.claude/rules/delivery.md` §5 と `.claude/agents/epic-tester.md` を直した。
* **Creation**: [EPIC #1 の総合試験のレポート](test-reports/epic-0001-dev-foundation.md)（1 回目、FAIL。AC-6 の原因はバグの PBI #72）と、その写真・記録（`test-reports/evidence/epic-0001/`）を追加し、[test-reports/index.md](test-reports/index.md) に載せた。
* **Update**: [conventions.md](architecture/conventions.md) に「D1 の 1 つの文の上限」（バインド変数は 100 個まで。複数行の INSERT は分ける）を足した（#34 で見つかった制約）。
* **Update**: コメントと返信（#35）に合わせて、[data-model.md](architecture/data-model.md) の「comments」に `client_request_id`（NULL 可・UNIQUE `(author_id, client_request_id)`。`migrations/0006`）と `comment_count` の増減の決まりを書き、[routes.md](architecture/routes.md) の `addComment`・`listReplies`・`deleteComment` の入力と結果を具体にし、`/e2e-harness/db` の操作にコメントを足した。
* **Creation**: [ADR-0041](adr/0041-e2e-setup-writes-go-through-the-app.md)（E2E の準備の書き込みは、テストのプロセスから D1 の SQLite を直接書かず、アプリの `/e2e-harness/db` を通す。SQLITE_BUSY で並列の E2E が落ちていた）を追加し、[routes.md](architecture/routes.md) に載せた（#32）。
* **Creation**: [ADR-0039](adr/0039-like-counter-moves-by-changes-in-one-db-batch.md)（いいねの件数は 1 つの `db.batch` の中で `changes()` だけ増減。件数はダイアログを開くボタン）を追加した（#34）。
* **Creation**: [ADR-0037](adr/0037-serve-local-media-from-garage-web-endpoint.md)（ローカルの画像は Garage のウェブ用エンドポイント 3912 から別 origin で配信。[ADR-0023](adr/0023-slots-with-garage-and-d1-files.md) を置き換え）を追加し、[overview.md](architecture/overview.md)・[ローカル開発の手順](guides/local-development.md) を更新した（#20）。
* **Update**: [conventions.md](architecture/conventions.md) の「認証とセッション」に、ログインが要る全ての処理と読み出しで `requireUser()` を呼ぶ決まりを足した（#26 のセキュリティレビュー）。
* **Creation**: [ADR-0029](adr/0029-signup-writes-rows-in-one-db-batch.md)（サインアップは 1 つの `db.batch`）、[ADR-0030](adr/0030-better-auth-session-and-rate-limit-rules.md)（認証の規則を引き継ぎ、セッション 30 日・延長なし・`email_verified`。[ADR-0020](adr/0020-better-auth-with-pbkdf2.md) を置き換え）、[ADR-0031](adr/0031-login-only-screens-in-app-route-group.md)（ログイン必須の画面は `(app)`）を追加し、[data-model.md](architecture/data-model.md)・[conventions.md](architecture/conventions.md)（項目ごとの文言・`toErrorResponse`・`charLength`・`consume`・`checkUsername` の制限）・[overview.md](architecture/overview.md) を更新した（#26）。
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
