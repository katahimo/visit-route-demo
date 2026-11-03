# ADR-0075：ほかのソフトの CSV を「形の一覧」で読む（予約システムのスタッフ・顧客・予約）

- 日付：2026-10-31
- 状態：採用

## 背景
予約システムのスタッフ・顧客・予約の CSV を読みたい。今後もほかのソフトの形が増える見込みで、形を足すたびに読み込みの本体・画面・契約を直すのは避けたい。

## 決定
形の一覧（レジストリ）を作り、形ごとのファイルは「列名で見分けて共通の中間の形に写す」だけにする。
- 名簿：`excel/rosterForms.ts` の `ROSTER_FORMS`（id・label・kind・`toRoster`・`errorMessage?`）。写したあとは `rosterRows`。顧客台帳（`ledgerCsv`）もここ
- 予約：`excel/bookingForms.ts` の `BOOKING_FORMS`（id・label・`toBookings`）。`Booking`（予約番号・日付・開始・所要・名前・取り消し・メモ）に写し、`importBookings` が〈利用者さん〉と名前で突き合わせ、ID `bk-〈形のID〉-〈予約番号〉` の単発の訪問（時刻固定・担当なし）を足す・直す
- 共通の部品は `excel/csvColumns.ts`（列名の比べ方・読まなかった列・`distinctNames`・`columnMessage`・`clip`・`RosterTable`）
- 元のソフトで空の多い欄は形ごとに `keepBlank`（空なら今の値のまま）
- 同じ名前の顧客は全員に顧客IDを添える。予約の名前がこの人に当たるときは入れない
- 契約：`RosterImportResult.otherForm: OtherFormRead | null`（`label`・`skippedColumns`）、`BookingImportResult`
- 予約の「新規登録者」は担当にしない。同じ予約番号は読み直すと直し、担当・ピンは残す
- 読まない列（パスワード・世帯・緊急連絡先など）はデータに残さない。予約の CSV の欄はデータの画面

## 捨てた案
形ごとに読み込みと入口を作る（本体・画面が増える）・列の割り当てを利用者が選ぶ（手間）。

## トレードオフ
- 失うもの：列名を変えたファイルは読めない（一覧に足す）
- 見直す条件：形が増えて列名の見分けがぶつかるとき
