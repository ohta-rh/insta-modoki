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

# 製品

* [ADR-0003: Instagram の UX と機能を忠実に再現し、ブランドは独自にする](0003-reproduce-ux-under-own-brand.md) - 採用

# 環境とホスティング

* [ADR-0006: マイルストーン 1 はローカルの docker compose で動かす](0006-first-milestone-runs-locally-on-docker-compose.md) - 採用
* [ADR-0008: compose のスタックを 1 つ共有し、スロットごとにポート・DB・バケットを分ける](0008-share-one-compose-stack-with-a-slot-per-worktree.md) - 採用
* [ADR-0011: デプロイ先は Cloudflare とし、無料枠に収めることを前提にする](0011-deploy-to-cloudflare-free-tier-first.md) - 採用

# ひな形

* [template.md](template.md) - ADR を書くときに写すひな形
