# 企画書

* [insta-modoki 企画書（PDF）](insta-modoki-proposal.pdf) - 2026-11-20 版。背景・機能の優先度・ワイヤーフレーム・データモデル・技術構成案・ロードマップ・リスク
* [企画書の原本（HTML）](proposal.html) - PDF の元。`build.sh` で PDF を作り直す
* [build.sh](build.sh) - headless Chrome で HTML から PDF を作るスクリプト

# 企画書から変わったこと

* ホスティングは Vercel・Neon ではなく Cloudflare を前提にする（[ADR-0011](../adr/0011-deploy-to-cloudflare-free-tier-first.md)）。企画書のそれ以外の技術構成は、まだ提案のまま
