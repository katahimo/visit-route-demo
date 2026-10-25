# ADR-0026：ブラウザ標準の確認をやめ、独自の確認ダイアログを使う

- 日付：2026-10-18
- 状態：採用
- 関連：PRD D146〜D150、ADR-0025

## 背景
- 消す・捨てる・置き換える・確定する前の確認は `window.confirm` だった。ブラウザの確認は画面の一番上に出てアプリの見た目と合わず、ボタンが「OK／キャンセル」で何が起きるかがボタンから分からない
- `window.confirm` は同期（押すまで JS が止まる）。独自のダイアログは待つ（Promise）ので、呼ぶ側を async にしても順序が壊れないようにする必要がある
- 変更があるまま再読込・タブを閉じるときの確認（`beforeunload`）は、ブラウザの仕様でページが自分の画面を出せない
- 例外の画面（`app/ErrorBoundary`）は Provider（データ・ルーター・トースト）より外にもある

制約：新しい依存を足さない。データ・契約・store は変えない。

## 選択肢
1. 案A：Promise を返す `confirm` 風の API（`await confirmDialog({ title, body, confirmLabel, tone })`）と、画面全体で1つの Provider。部品は Provider が無くても単独で出せる
2. 案B：画面ごとに「確認中」の状態を持ち、その場に確認の欄を出す
3. 案C：HTML の `<dialog>`（`showModal()`）
4. 案D：ライブラリ（Radix など）

## 決定
案A。
- 純粋な部分は `lib/confirmDialog.ts`：頼み方（見出し・本文・確定の文言・取り消しの文言・色 `danger|primary`）、待っている確認の並び（先頭の1つだけを出し、2回押しても1回だけ答える）、Tab を回す行き先
- 部品は `components/ConfirmDialog.tsx`（`ConfirmProvider`・`useConfirm()`）：body の直下に出す `role="alertdialog"`・`aria-modal`。最初のフォーカスは取り消し、Tab は中で回す、Esc・背景を押すは取り消し、閉じたら元の要素へ戻す。裏は `useBodyScrollLock` と inert。キーは window の捕捉の段で受け、右の欄・引き出しの Esc に渡さない
- 色は、危険（赤）が消す・捨てる・すべて置き換える・初期状態に戻す・取り消す、オレンジが確定・コピー・動かすなど戻せる操作・データを消さない操作。ボタンには動詞を書く
- 同期を前提にしていた箇所は、確認の後に「計算中でないか」「データが変わっていないか」を見直す。変更を捨てる確認は `lib/viewMode` の `discardDialog`
- ErrorBoundary は `ConfirmDialog` を自分の状態で直に出す（Provider に頼らない）。`beforeunload` はブラウザの確認のまま
- 確認が出ているあいだに画面のパスが変わったら（「戻る」など）、`ConfirmProvider` は待っている確認をすべて false で答えて閉じる（クエリだけの変化では閉じない。外れた画面の続きが動いてデータを書くのを防ぐ）
- ダブルクリックで確認がすぐ取り消されないよう、背景のクリックは開いてから300ms と連続のクリックを無視する
- inert の付け外しは、要素ごとに数えるロック `lib/inertLock`（画面全体で1つ）に集める。メニューの引き出しと確認が重なっても、閉じる順で `#root` が inert のまま残らない
- e2e は `page.on('dialog')` で受けられないので、共通の `scripts/lib/confirmDialog.cjs` で受ける（ネイティブのダイアログが出たら失敗）

## 理由とトレードオフ
- 得るもの：画面の中央にアプリの見た目で出て、問いと何が起きるかをボタンの動詞で判断できる。消す操作は赤で区別できる。呼ぶ側の変更は「`confirm(文)` → `await confirmDialog({...})`」で小さい。キーボード・読み上げの扱いが1か所
- 失うもの：確認のあいだに画面を移ると、答える前の確認は黙って取り消しになる。確認が非同期なので、確認のあいだに別のタブでデータが変わると、確認の前に読んだ中身で進む箇所がある（多くは `update(fn)` で最新のデータに当てる）。部品と CSS が増える
- 捨てた案：案B は確認の数だけ状態と欄を足すことになり見た目と操作がばらつく。案C は Esc・背景・フォーカスの戻しをどのみち自分で書き、右の欄との重なりの順もそろえにくい。案D は依存が増え、SidePanel・NavDrawer と作りがそろわない

## 影響
- `components/ConfirmDialog.tsx`・`confirmDialog.css`（z-index 1300：右の欄・引き出し・トーストより前。印刷では出さない）、`main.tsx`（`ConfirmProvider`）、`app/ErrorBoundary.tsx`、`lib/confirmDialog`・`inertLock`・`viewMode`、確認を出す各画面。データ・契約・store は変えない
- 見直す条件：読ませる必要があるエラーや入力を求める場面ができたら、同じ部品にボタン1つの形・入力欄の形を足す
