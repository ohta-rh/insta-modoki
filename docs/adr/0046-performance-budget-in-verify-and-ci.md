---
type: ADR
title: "ADR-0046: 性能の基準は THRESHOLDS に 1 か所で定め、初期 JS は verify の既定の手順で、Lighthouse・INP・フィード API の p95 は --with-perf と main への push の CI で検査する"
description: "企画書の 6 つの基準を scripts/perf/thresholds.mjs の THRESHOLDS に置く。初期 JS（gzip）は速いので verify の perf-budget に、遅い計測は --with-perf の perf と CI の perf の job（main への push のみ）に分ける。Lighthouse は Playwright 同梱の Chromium を --remote-debugging-port で使う。"
tags: [performance, verify, ci, testing]
status: stable
---

# ADR-0046: 性能の基準は THRESHOLDS に 1 か所で定め、初期 JS は verify の既定の手順で、Lighthouse・INP・フィード API の p95 は --with-perf と main への push の CI で検査する

- ステータス: 採用
- 日付: 2026-11-21
- 決定者: Director（#45 の精緻化で決定し、実装者が記録）
- 関連: #45、[ADR-0009](0009-tdd-review-e2e-verify-loop.md)、[ADR-0019](0019-d1-and-drizzle.md)、[ADR-0024](0024-verify-command-and-coverage-gate.md)、[ADR-0027](0027-ci-runs-verify-and-docs-check.md)、[ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)

## 背景

企画書は、Lighthouse のモバイルで 90 点以上、LCP 2.5 秒・INP 200ms・CLS 0.1 以内、フィード API の p95 300ms 以内、初期 JS 170KB 以内を求め、基準を満たさない変更は CI で検出するとしている。測るスクリプトも、割れたら失敗する仕組みも無かった。`getFeed` は `/` の描画と Server Action の中からだけ呼ばれ、外から呼べる HTTP の口は無い（#44）。計測は `seed:bench`（1,000 人・10,000 件）の上で行うので数分〜十数分かかり、`verify` の既定の手順に入れると毎回の確認が遅くなる。

## 決定

- 基準は `scripts/perf/thresholds.mjs` の `THRESHOLDS`（`lighthouseScore: 90`、`lcpMs: 2500`、`inpMs: 200`、`cls: 0.1`、`feedApiP95Ms: 300`、`initialJsGzipBytes: 170000`）に 1 か所で定める。「170KB」は 1,000 バイトで数える（厳しい側で読む）。基準ちょうどは通り、1 つ超えると落ちる（`evaluate`）。失敗の出力は `perf: FAIL <指標> <画面> <値> > <基準>`（点数だけは下限なので `<`）で、終了コードは 1。
- 初期 JS の検査 `scripts/perf/bundle.mjs` は速い（新しい利用者で 1 回開くだけ）ので、`verify` の既定の手順 `perf-budget` として `e2e` の後に置く。`/` を開いて読み込まれた同じ origin の JavaScript の全ての応答を gzip（レベル 9）して足す。
- 遅い計測（`scripts/perf/run.mjs`: Lighthouse を 3 画面 × 3 回、INP、フィード API 220 回）は `verify.mjs --with-perf` を付けたときだけ手順 `perf` として足す。CI では job `perf` を `main` への push のときだけ動かし（`if: github.event_name == 'push'`）、ビルドと `seed:bench` の後に `node scripts/verify.mjs --only perf --with-perf` を流す。pull request では動かさない。
- フィード API の p95 は、`demo` の利用者（`seed:bench` で 100 人をフォロー）のセッションの Cookie つきの `GET /` の最初のバイトまでの時間で測る。準備の 20 回の後に 200 回。D1 は計測のプロセスから書かない（[ADR-0041](0041-e2e-setup-writes-go-through-the-app.md)）。
- Lighthouse は `lighthouse` の Node の API（モバイルの既定: 模擬の低速 4G・CPU 4 倍）で、Playwright 同梱の Chromium を `--remote-debugging-port` で起動して接続する（`channel: 'chrome'` は使わない。計測は総合試験ではなく、CI でも同じにするため）。ログインは Playwright で行い、`disableStorageReset` で Cookie を残す。INP は `web-vitals` を `page.addInitScript` で入れ、CPU 4 倍・幅 375px で測る。
- devDependency に `lighthouse`（13.6.0、2026-10-27 公開）と `web-vitals`（6.2.3、2026-10-05 公開）を足す。結果は `perf-results/*.json`（git に入れない）。
- 基準を割った箇所は、割れた指標に関わる箇所だけを直す。修正が 1 日を超える分は新しい PBI に切る。

## 検討した選択肢

| 選択肢 | 長所 | 短所 |
|---|---|---|
| 初期 JS は既定の手順、他は `--with-perf` と CI の push（採用） | 毎回の verify が速いまま、サイズの増加は手元で落ちる。重い計測は `main` を毎回守る | Lighthouse・INP・p95 の悪化は push の後に分かる |
| 全部を既定の verify に入れる | 悪化を `main` の前に止める | シード（数分〜十数分）と 9 回の Lighthouse で毎回が遅く、他のスロットの負荷で値がぶれる |
| 全部を CI の pull request でも流す | 悪化を `main` の前に止める | このリポジトリは PR を使わない（`main` に直接）。CI の時間が増える |
| Lighthouse CI（`@lhci/cli`）を使う | しきい値の仕組みが既製 | 依存が増え、認証つきの画面・INP・p95・初期 JS は別に要る。6 つの基準を 1 か所で扱えない |
| Lighthouse を `channel: 'chrome'` で動かす | 実 Chrome に近い | CI に Chrome が要り、版が揺れる。総合試験ではない |
| フィード API 用に HTTP の口を足す | 呼び出しを直接測れる | `getFeed` の入口を増やし、本番の経路と違う（#44 は外に口を出さない） |

## 結果

- 初期 JS の基準は手元の verify と CI の両方で落ちる。他の 5 つは CI の `perf` の job と、手元の `--with-perf` で落ちる。
- 受け入れるコスト: Lighthouse の点数は機械の負荷で揺れる（3 回の中央値で和らげる。他のスロットの重い処理が動いていないときに測る）。`perf` の job は `main` への push ごとに 30 分まで使う。
- 守ること: 基準を変えるときは `THRESHOLDS` と企画書への根拠を同じ commit で変える。クライアントのコンポーネントは zod など検証のライブラリを読み込む `model/schema.ts` から値を import せず、上限や文言は `model/limits.ts` に置く（初期 JS が 33KB 減った。`docs/test-reports/perf-2026-11-21.md`）。手順を足すときは `docs/guides/verify.md` を同じ commit で変える。
