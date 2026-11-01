# ADR-0039：重い画面と地図を別のチャンクに分け、計算の進み具合は外の入れ物で子だけ描き直す

- 日付：2026-10-19
- 状態：採用
- 関連：ADR-0006

## 背景
最初の画面を開くだけで重い画面と地図（Leaflet）まで読み、計算中は進み具合（100ms ごと）で画面全体を描き直していた。HashRouter・相対パスのまま、URL は変えない。

## 決定
- 重い画面（日・空き状況・比較・相性・月など）を `React.lazy`、地図は `RouteMap` の中で本体を `lazy`（`src/app/lazyPages.tsx`）
- 画面が出たら残りを `requestIdleCallback` で1つずつ先読み（`PreloadWhenShown`）。直接開いた画面はすぐそのチャンクを読む
- `Suspense` は本文に1つ。移動は transition で前の画面のまま待つ。地図は指定の高さの枠に出す
- 読み終わったチャンクは `components/lazyComponent` で直に描く
- 読めないとき：ErrorBoundary が動的 import の失敗（`lib/chunkLoad`）を見分け、［再読み込み］［もう一度表示する］（`?retry=N`）。自動では読み直さない
- 進み具合は外の入れ物（`lib/valueStore`＋`useSyncExternalStore`）から、バーと回数の部品だけが読む

## 捨てた案
全画面を `lazy`（よく使う画面の待ちが増える）・vendor 分け（初回の量が減らない）・`startTransition`（描き直す量が減らない）。

## トレードオフ
- 失うもの：先読みが終わる前に移ると前の画面のまま待つ
- 見直す条件：本体に残る画面が重くなったとき
