# ADR-0026：ブラウザ標準の確認をやめ、独自の確認ダイアログを使う

- 日付：2026-10-18
- 状態：採用

## 背景
`window.confirm` は見た目が合わず「OK／キャンセル」で何が起きるか分からない。

## 決定
Promise を返す `await confirmDialog({ title, body, confirmLabel, tone })` と、画面全体で1つの `ConfirmProvider`。
- 純粋な部分は `lib/confirmDialog.ts`（頼み方・待ちの並び（先頭の1つだけ出す）・Tab の行き先）
- 部品は `components/ConfirmDialog.tsx`（`role="alertdialog"`）。最初のフォーカスは取り消し、Esc・背景は取り消し、閉じたら元へ戻す。キーは捕捉の段で受け、右の欄・引き出しへ渡さない
- 色：赤は消す・捨てる・置き換える・初期化・取り消す、オレンジは戻せる操作。ボタンには動詞
- 確認の後に「計算中でないか」「データが変わっていないか」を見直す
- 画面のパスが変わったら待っている確認をすべて false で閉じる。背景のクリックは開いて300ms 無視
- inert は要素ごとに数える `lib/inertLock`
- ErrorBoundary は Provider に頼らず自分で出す。`beforeunload` はブラウザの確認のまま
- e2e は `scripts/lib/confirmDialog.cjs` で受ける（ネイティブのダイアログが出たら失敗）

## 捨てた案
画面ごとに確認の欄（ばらつく）・`<dialog>`（結局自前で書く）・ライブラリ（依存が増える）。

## トレードオフ
- 失うもの：確認のあいだに画面を移ると黙って取り消しになる
