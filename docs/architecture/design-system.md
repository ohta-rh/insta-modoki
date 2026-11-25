---
type: Architecture
title: デザインシステム（トークン・ロゴ・アイコン・ナビ）
description: 色・余白・文字の大きさのトークン、自作のロゴとアイコン、使わない他社の資産と禁止語、色の使い方の決まり、画面の骨格（AppShell とナビの切り替え）。画面の PBI はこれを前提に作る。
tags: [architecture, design, accessibility]
status: stable
---

# デザインシステム

すべての画面が同じ色・余白・ナビを使うための決まり。値の持ち主は `src/shared/ui/tokens.css`（Tailwind の `@theme`）で、`tokens.ts` が同じ値を TypeScript に持つ。両者は `tokens.test.ts` が突き合わせる。他社のブランドは使わない（[ADR-0003](../adr/0003-reproduce-ux-under-own-brand.md)）。

## トークン

| 名前 | 値 | 使い方 |
|---|---|---|
| `--color-bg` | `#ffffff` | 背景 |
| `--color-surface` | `#f4f6f9` | 面（カード・ホバー） |
| `--color-text` | `#111827` | 本文 |
| `--color-text-secondary` | `#374151` | 補助の文字（bg と surface の上） |
| `--color-text-muted` | `#6b7280` | 弱い文字（bg の上だけ） |
| `--color-border` | `#e5e7eb` | 罫線 |
| `--color-link` | `#2b6cf6` | リンク（bg の上だけ） |
| `--color-teal` / `--color-indigo` / `--color-coral` | `#0bb8a9` / `#4f46c8` / `#ff6b5e` | 図形・塗り・フォーカスの輪郭（文字には使わない） |
| `--gradient-window` | `linear-gradient(120deg, #0bb8a9, #2b6cf6 62%, #4f46c8)` | ロゴの窓 |
| `--space-1`〜`--space-8` | 4・8・12・16・24・32・48・64px | 余白 |
| `--font-size-xs`〜`--font-size-xl` | 12・14・16・20・24px | 文字の大きさ |
| `--font-family` | `system-ui, -apple-system, 'Noto Sans JP', sans-serif` | ウェブフォントは読み込まない |
| `--breakpoint-nav` | 768px | 下部ナビとサイドナビの切り替え（Tailwind の `nav:`） |
| `--tap-min` | 44px | タップ領域の最小 |
| `--bottom-nav-height` / `--content-max` | 56px / 630px | 下部ナビの高さ / 本文の最大幅 |
| `--motion-fast` | 150ms（視差効果を減らす設定で 0ms） | トランジションの長さ |

## 色の使い方の決まり

- 本文の組は 4.5:1 以上。`contrast.ts` の `BODY_PAIRS`（`text`/`bg`、`text-secondary`/`bg`、`text-secondary`/`surface`、`text-muted`/`bg`、`link`/`bg`）を `contrast.test.ts` が確かめる。`text-muted` と `link` は白（`bg`）の上だけに使い、`surface` の上では使わない。
- ティール・コーラル・インディゴは文字色に使わない。コーラル（2.79:1）とティール（2.49:1）は白の上で 3:1 に届かないので、状態を伝える図形はインディゴか文字色と形（塗りつぶし）で示す。
- フォーカスの輪郭は 2px のインディゴ（白の上で 6.9:1）、オフセット 2px（`globals.css`）。
- 色だけで状態を伝えない（現在のナビは太字と線でも示す）。

## ロゴ

アーチ窓と陽の光。自作。`public/brand/logo.svg`（印とワードマーク）・`logo-mark.svg`・`favicon.svg`、React では `Logo`。名前 Mado は仮称（M2 で確定）で、`aria-label` は「Mado（仮称）」。

## アイコン

`src/shared/ui/icons/` の SVG の部品。全て自作で、24px の格子・線の太さ 1.5・`aria-hidden="true"`（名前は使うボタンやリンクが持つ）。`HomeIcon` `SearchIcon` `PlusSquareIcon` `BellIcon` `UserIcon` `HeartIcon` `HeartFilledIcon` `CommentIcon` `SendIcon` `BookmarkIcon` `BookmarkFilledIcon` `CloseIcon` `ChevronLeftIcon` `ChevronRightIcon` `MoreIcon`。他社のアイコンの形を写さない。

## 使わない他社の資産と禁止語

他社の名前・ロゴ・アイコン・フォント・画像・スクリプトを使わない。`public/brand/` と `src/shared/ui/` に、他社のサービス名とその略称、運営会社名（フッターの「Meta 社とは関係ありません」を除く）、外部の URL（SVG の名前空間を除く）を書かない。`brand.test.ts` が確かめる。

## 画面の骨格

`AppShell`（`currentPath`・`viewer`・`hideNav?`・`children`）が、スキップリンク（「本文へ移動」、`#main`）→ サイドナビ → `<main id="main">`（最大幅 630px、中央）→ フッター → 下部ナビの順に描く。

- 768px 以上: 左のサイドナビ（アイコンと名前）。768px 未満: 画面の下に固定の下部ナビ（高さ 56px と下の安全領域）。切り替えは CSS だけ（`nav:`）。
- 項目は ホーム・検索・投稿・通知・プロフィール の順。ログインしていない（`viewer` が `null`）と、投稿・通知・プロフィールは `/accounts/login` へ向かう。
- 現在の項目に `aria-current="page"`（`/` はちょうど `/` のとき、他は先頭が一致するとき）。項目は幅も高さも 44px 以上。
- ルートのレイアウトは `AppShellClient`（`usePathname()` で現在のパスを取る）で包む。登録・ログインの画面は `hideNav` を使う。
- 項目は `next/link` ではなく通常の `<a>`。まだ無い画面を先読みして 404 を出さないため。画面が揃ったら、先読みの要否を #46 の検査と合わせて見直せる。

## アクセシビリティ

主要 8 画面と 2 つの重ねた画面（投稿のモーダル・いいねした人の一覧）を、375px で `e2e/a11y.spec.ts`（axe: `wcag2a`・`wcag2aa`・`wcag21a`・`wcag21aa`・`wcag22aa` の `critical`・`serious`、タップ領域 44×44px、alt、いいねの状態、`h1`、`lang`）、`e2e/keyboard.spec.ts`（キーボードだけの通し・輪郭 2px 以上・モーダルの閉じ込め）、`e2e/reduced-motion.spec.ts`（視差効果を減らす設定）が検査する（#46）。

- 写真の代わりの文は `photoAlt`（`src/features/post/model/alt-text.ts`）が 1 か所で作る。投稿者の文が無いときは `<username> が投稿した写真（<位置> / <枚数>）`。投稿詳細・カルーセル・フィード・プロフィールのグリッド・モーダルが使う。ヘッダーのアイコンの `alt=""` は、隣に名前がある飾りなので正しい。
- 動き（実際に動くもの）: カルーセルの `scroll-behavior`（設定が無いと `smooth`、視差効果を減らす設定で `auto`）と、モーダルの `post-modal-in`（`animation-duration` が設定の無いとき 0 より大きく、減らす設定で 0s）。`transition-duration` は減らす設定で 0s。
- axe は途中の透明度の色で対比を測るので、モーダルの検査は出現の動き（`document.getAnimations()`）が終わるのを待つ。

見つかった違反と直した所:

| 規則 | 画面 | 直した所 |
|---|---|---|
| 操作できる要素が 44×44px 以上（AC-7） | 投稿の作成 | 比率のラジオ 2 つ（13×13px）を `CreatePostForm.tsx` で `--tap-min` の大きさにした |
| 視差効果を減らさないときの動き（AC-6） | 投稿詳細（カルーセル） | 帯の `scroll-behavior` が `auto` のままだったので、`Carousel.tsx` に `motion-safe:scroll-smooth` を足した（モーダルの `post-modal-in` は元から正しく、直していない） |
| 写真の代わりの文の形（AC-8） | 投稿詳細・フィード・プロフィールのグリッド・モーダル | `@<username> の写真 <n>` を `photoAlt` の `<username> が投稿した写真（<位置> / <枚数>）` に統一した |

上の他に、axe の重大・深刻な違反、`h1` の数、`lang`、輪郭の太さ、モーダルの閉じ込め、いいねの `aria-pressed` と形は、最初の検査で違反が無かった。
