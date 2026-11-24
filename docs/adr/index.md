# Architecture Decision Records

書き方は [ADR-0001](0001-record-architecture-decisions.md) と [template.md](template.md)。

# プロセス

* [ADR-0001: 決定は ADR として docs/adr/ に記録する](0001-record-architecture-decisions.md) - 採用
* [ADR-0002: docs/ を OKF v0.3 のバンドルとして管理する](0002-docs-as-okf-v0-3-bundle.md) - 採用
* [ADR-0004: issue はマイルストーン → EPIC → PBI の順に起票し、全てに DoR・AC・DoD を書く](0004-milestone-epic-pbi-with-dor-ac-dod.md) - 採用
* [ADR-0005: 起票の時点で依存関係と触るファイルを整理し、PBI を並列に進められる形に切る](0005-map-dependencies-for-parallel-work-at-filing.md) - 採用
* [ADR-0007: Director が PBI ごとに sonnet の実装者を独立した worktree で動かす](0007-director-dispatches-sonnet-implementers-in-worktrees.md) - 採用
* [ADR-0009: TDD → 実装 → レビュー → E2E → verify を AC と DoD を満たすまで繰り返す](0009-tdd-review-e2e-verify-loop.md) - 採用
* [ADR-0010: コードレビューとセキュリティレビューを独立した sonnet のサブエージェントで行う](0010-independent-code-and-security-review.md) - 採用
* [ADR-0012: EPIC が完了したら実ブラウザで総合試験を行い、エビデンスを commit する](0012-epic-integrated-test-in-real-browser.md) - 採用
* [ADR-0017: PR を求められたマイルストーンは統合ブランチに入れ、main への PR を 1 つ出す](0017-milestone-on-an-integration-branch-when-a-pr-is-requested.md) - 採用
* [ADR-0015: PBI と EPIC はグローバルの write-pbi スキルの水準で書き、このリポジトリの DoR・DoD を写す](0015-pbis-follow-the-global-write-pbi-standard.md) - 採用
* [ADR-0058: 結合テストの seed は他の結合テストと重ねず、verify の別の手順で後から流す](0058-seed-integration-test-runs-in-its-own-verify-step.md) - 採用
* [ADR-0059: 結合テストは単独で上限の 25% 以内に収め、verify の int-budget で変わったファイルを測る](0059-integration-tests-stay-within-a-quarter-of-their-timeout.md) - 採用
* [ADR-0060: 結合テストはスロットのバケットに作ったファイルを消して終わり、slot.mjs はバケットを 32 本並べた DELETE で空にする](0060-tests-clean-their-objects-and-slot-empties-buckets-in-parallel.md) - 採用
* [ADR-0064: docs/log.md は union merge で統合する](0064-docs-log-merges-as-union.md) - 採用
* [ADR-0066: 見た目の PBI は、狭い画面で長い利用者の文字の配置を AC にする](0066-visual-pbis-test-long-text-at-narrow-width.md) - 採用

# 製品と計画

* [ADR-0003: Instagram の UX と機能を忠実に再現し、ブランドは独自にする](0003-reproduce-ux-under-own-brand.md) - 採用
* [ADR-0013: ロードマップを 4 つのマイルストーン（ローカルの MVP → Cloudflare で公開 → Phase 2 → Phase 3）に組み直す](0013-four-milestones-local-mvp-then-cloudflare.md) - 置き換え（ADR-0052）

# アーキテクチャ

* [ADR-0056: UI の値は実測した参照の Web 版に従い、ブランドの色と形は自前のままにする](0056-ui-follows-measured-web-reference-under-own-brand.md) - 採用
* [ADR-0061: 作成のモーダルは、ルートのレイアウトの modal スロットの intercepting route で開く](0061-create-modal-intercepts-from-a-root-modal-slot.md) - 採用
* [ADR-0062: verify は同じマシンで一度に 1 つだけ走り、確かめた HEAD を出力に残す](0062-verify-runs-one-at-a-time-and-records-head.md) - 採用
* [ADR-0014: コードは機能ごとの slice（src/features/<name>/）と共有の部分（src/shared/）に分ける](0014-code-in-feature-slices.md) - 採用
* [ADR-0050: 通知は SSE で画面へ押し出し、サーバーは 3 秒ごとに D1 を確認する（Durable Objects は使わない）](0050-notifications-via-sse-with-d1-checks.md) - 採用
* [ADR-0054: ハイドレーション前に選ばれたファイルはマウント時に取り込み、選択は無効にしない](0054-pick-up-files-chosen-before-hydration-on-mount.md) - 採用
* [ADR-0016: 言語は TypeScript、UI は React にする（フレームワークは #18 で決める）](0016-typescript-and-react.md) - 採用
* [ADR-0018: アプリは Next.js 16（App Router）を OpenNext で Cloudflare Workers に載せて動かす](0018-nextjs-on-workers-via-opennext.md) - 採用
* [ADR-0019: DB は Cloudflare D1、ORM は Drizzle ORM にする](0019-d1-and-drizzle.md) - 採用
* [ADR-0020: 認証は Better Auth（メールとパスワード、DB のセッション）にし、ハッシュは PBKDF2-SHA256 に差し替える](0020-better-auth-with-pbkdf2.md) - 置き換え: ADR-0030
* [ADR-0021: 画像はブラウザで 3 幅の WebP を作り、署名付き PUT で R2 に直接置く。ローカルのストレージは Garage にする](0021-browser-made-webp-and-presigned-put.md) - 採用
* [ADR-0022: テストは Vitest と Playwright、UI は Tailwind CSS と Radix UI、実行環境は Node.js 26 と pnpm 12 にする](0022-testing-ui-and-package-management.md) - 採用
* [ADR-0028: 最初のマイグレーションは制約名と空白の扱いを固定し、DB の結合テストは D1 のメモリで流して `_test` の名前の DB にしか繋がない](0028-first-migration-conventions-and-test-db.md) - 採用
* [ADR-0024: verify は scripts/verify.mjs が 7 つの手順を固定の順に流し、単体テストの行カバレッジ 80% を基準にする](0024-verify-command-and-coverage-gate.md) - 採用
* [ADR-0026: CSP は src/proxy.ts が要求ごとの nonce で付け、静的ファイルは public/_headers で付ける](0026-csp-with-nonce-from-proxy-and-headers-file.md) - 採用
* [ADR-0027: CI は GitHub Actions の 1 つの job で verify を流し、docs の検査は依存の無い scripts/check-docs.mjs を verify の手順にする](0027-ci-runs-verify-and-docs-check.md) - 採用
* [ADR-0029: サインアップは利用者・パスワード・セッションを 1 つの db.batch で書き、Better Auth の signUpEmail とその HTTP ハンドラーは使わない](0029-signup-writes-rows-in-one-db-batch.md) - 採用
* [ADR-0030: 認証は Better Auth と PBKDF2-SHA256 + pepper のまま、セッションは 30 日・延長なしにし、users に email_verified を足す](0030-better-auth-session-and-rate-limit-rules.md) - 採用（ADR-0020 を置き換える）
* [ADR-0031: ログインが必要な画面はルートグループ (app) に置き、そのレイアウトが未ログインを /accounts/login へ redirect する](0031-login-only-screens-in-app-route-group.md) - 採用
* [ADR-0039: いいねの件数は、1 つの db.batch の中で直前の文の changes() だけ増減させる](0039-like-counter-moves-by-changes-in-one-db-batch.md) - 採用

# 環境とホスティング

* [ADR-0006: マイルストーン 1 はローカルの docker compose で動かす](0006-first-milestone-runs-locally-on-docker-compose.md) - 採用
* [ADR-0008: compose のスタックを 1 つ共有し、スロットごとにポート・DB・バケットを分ける](0008-share-one-compose-stack-with-a-slot-per-worktree.md) - 置き換え: ADR-0023
* [ADR-0023: compose のサービスは Garage だけにし、スロットは D1 のファイル・バケット・.dev.vars で分ける](0023-slots-with-garage-and-d1-files.md) - 置き換え: ADR-0037
* [ADR-0037: ローカルの画像は Garage のウェブ用エンドポイント（3912）から別 origin で配信する](0037-serve-local-media-from-garage-web-endpoint.md) - 採用
* [ADR-0011: デプロイ先は Cloudflare とし、無料枠に収めることを前提にする](0011-deploy-to-cloudflare-free-tier-first.md) - 採用
* [ADR-0049: 定期ジョブは Cron Trigger から Worker の入口 src/worker.mjs で起動し、Worker と Node で同じコードを動かす](0049-scheduled-jobs-run-from-cron-trigger-in-a-custom-worker-entry.md) - 採用
* [ADR-0041: E2E の準備の書き込みは、テストのプロセスから SQLite を直接書かず、アプリの /e2e-harness/db を通す](0041-e2e-setup-writes-go-through-the-app.md) - 採用
* [ADR-0043: プロフィールのグリッドからのモーダルは、Next.js の intercepting routes と parallel routes で作る](0043-profile-grid-modal-by-intercepting-route.md) - 採用
* [ADR-0045: chrome-devtools の MCP が使えないとき、epic-tester は画面ありの Google Chrome を CDP で操作して総合試験を行う](0045-epic-test-may-drive-headed-chrome-over-cdp.md) - 採用
* [ADR-0046: 性能の基準は THRESHOLDS に 1 か所で定め、初期 JS は verify の既定の手順で、Lighthouse・INP・フィード API の p95 は --with-perf と main への push の CI で検査する](0046-performance-budget-in-verify-and-ci.md) - 採用
* [ADR-0048: 確かめた AC はその場で issue のチェックを付け、PASS した EPIC の画面に後から触れたら総合試験をやり直す](0048-tick-ac-on-evidence-and-retest-epics-after-later-changes.md) - 採用
* [ADR-0052: マイルストーンの順番を M1 → M3（Phase 2 をローカルで）→ M2（Cloudflare で公開）→ M4 に変える](0052-phase-2-before-cloudflare-publication.md) - 採用
* [ADR-0053: slice は、他の slice が import する index.ts に部品を入れられないとき、ルートが使う部品の入口 ui/index.ts を別に持てる](0053-slice-may-add-ui-entry-to-keep-components-out-of-index.md) - 置き換え: ADR-0057
* [ADR-0057: slice の入口 index.ts は 'use client' の部品を公開せず、画面の部品は ui/index.ts から公開する](0057-slice-index-exports-no-client-components.md) - 採用
* [ADR-0055: E2E のサーバーは招待コードを必須にせず、E2E 専用のリクエストヘッダーで、そのリクエストだけ必須にする](0055-e2e-invite-required-by-request-header.md) - 採用
* [ADR-0065: サブエージェントの報告は、確認ごとに rc の行と結果の行を写し、道具が起動しなければ止まる](0065-agent-reports-carry-rc-and-result-lines.md) - 採用
* [ADR-0067: 統合ブランチの CI が赤いときは、ほかの作業より先に直す。ci-gate で機械的に確かめる](0067-red-integration-ci-comes-first.md) - 採用
* [ADR-0069: E2E は、サインアップを確かめない場面では E2E 用の窓口の seedSession でログイン済みのユーザーを用意する](0069-e2e-signs-in-through-the-harness.md) - 採用

# ひな形

* [template.md](template.md) - ADR を書くときに写すひな形
