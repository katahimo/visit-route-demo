# 相性の画面

> この画面のファイル：`src/pages/CompatPage.tsx`（表 `compatTable.tsx`・相性を選ぶ欄 `compatChoice.tsx`・絞り込みの欄 `compatFilters.tsx`・絞り込みの状態 `useCompatFilters.ts`）、`src/lib/compatView.ts`・`compatLevel.ts`・`gridFocus.ts`・`clientFilter.ts`、`src/components/StaffFilter.tsx`・`ClientFilter.tsx`・`DetailPopover.tsx`・`personDetail.tsx`。関連 ADR：0022・0028・0047・0067・0087。関連 PRD：D113〜D117・D177・D214〜D215・D221・D253・D272・D394・D420。
> 名前から開く詳細の部品は [pages-common.md](pages-common.md)、`ClientFilter` は [pages-clients.md](pages-clients.md)。

### 相性（`#/compat`）

訪問先×〈スタッフ〉の表。人のタブ「相性」。`lead`「マスを押して相性を選びます」（記号は並べない。意味は凡例の1行）。◎○は点が下がり（選ばれやすい）、△は点が上がる。× は担当にしない。休止中の人は出さない（注記も出さない）。画面の操作は少なく：表の外はタブ・「絞り込み」・（入だけ）「点のしくみ」、表は Tab の止まり所1つ（ADR-0087）。

- 題名の下は〈スタッフ〉または〈利用者さん〉の小さいタブ（`PeopleTabs`。入切とも。どちらから来たかを `components/peopleSide` が覚え、メニューの印も来た側）。予定を組むの段は出さない
- エキスパート機能の入切の差は1つ：入だけ凡例の横に「点のしくみ」（点・条件の重みの話）。切は出さない（`lib/peopleView` の `compatHintLabel` が null）

#### URL とクエリ

| クエリ | 意味 |
|---|---|
| `?sf=` | 〈スタッフ〉の列の絞り込み（`encodeStaffFilter`：`q:…;chip:k1,k2`） |
| `?cf=` | 〈利用者さん〉の行の絞り込み（`encodeFilter`。相性のチップは `x:k1,k2`） |

既定のままなら消し、`replace` で書く。知らないチップ・項目を捨てたら URL も書き直す。

#### 絞り込みの欄

- 表の上に1つの畳んだ「絞り込み」（`details`・`compat-filters`。中に〈スタッフ〉（列）`compat-sf-box` と〈利用者さん〉（行）`compat-cf-box`、1100px〜は横に並べる）。要約は `compatFilterSummary`（絞っていなければ「絞り込みなし」、絞れば絞った側の人数と中身）。URL に `?sf=`・`?cf=` のどちらかがあるときだけ開く
- `StaffFilter`（`?sf=`）：列の名前の検索と特性のチップ（文字の扱い・チップの見た目・「絞り込みを戻す」は `ClientFilter` と同じ）
- `ClientFilter`（`?cf=`。既定 `EMPTY_FILTER`。読んだあと `showEnded` は false。`hideEnded`）。期間は選んでいる日を含む週の `weekDay`（相性だけが変わったときは作り直さない）。`extraChips` に相性のチップ、`facts.extraTests` は `compatChipSets`（pending は絞り込んだ列、ng は休止中でない〈スタッフ〉）
- 相性のチップの判定に使う相性は、絞り込みを変えたときの写しに止める（マスの相性を変えても行を消さない）。写しが古く相性のチップを押していれば「表を並べ直す」（小さいボタン）を出す
- 0人なら表の代わりに `Empty` と「絞り込みを戻す」

#### 表

- 枠の中で巻き、見出しの行と1列目を止める（sticky）
- 箱は `EdgeScroll`（`table-scroll compat-scroll`）。右端のぼかしは [pages.md](pages.md) の「狭い画面の表」
- 600px 以下は行の名前の列（`.avail-name`）を 7em に詰めて空白で折り返す（頭文字の丸は出さない。`settings.css`）
- 列の見出しの名前は `nameLines`（最初の空白で名字・名の2行、空白が無ければ `NAME_CHUNK`＝4文字ごと）
- 行は `memo` の部品 `CompatRow`（`compatTable.tsx`）。300人×60人で相性を1回選んで描き終わるまで 100ms 以下。矢印で動くと描き直すのは動く前と後の行だけ
- grid（`role="grid"`。`<table>` のまま。ADR-0087）：マス（`td`）・列の見出し（`th scope="col"`）・行の名前（`th scope="row"`）はボタンにしない。Tab の止まり所は1つ（roving tabindex。位置は `{ row, col }`、row −1＝見出しの行、col −1＝名前の列。はじめは最初のマス、押した所へ移る）。キーと押したのは表の1か所で受ける（`data-kind`＝staff・client・cell）。矢印・Home・End・Ctrl＋Home／End・PageUp／PageDown（`lib/gridFocus` の `moveGridPos`。左上の角には止まらない）、絞り込みで行・列が減ったら `clampGridPos`
- マス：細い線の格子に記号だけ（入れた相性だけ薄い地の色）。`title`「〈利用者さん〉 × 〈スタッフ〉：〈意味〉（押すと選べます）」・`aria-label`「〈利用者さん〉と〈スタッフ〉の相性：〈意味〉」・`aria-haspopup="dialog"`。意味は `lib/compatLevel` の `COMPAT_MEANING`（◎ 選ばれやすい・○ やや選ばれやすい・未入力（ふつう）・△ 選ばれにくい・× 担当にしない）
- マスを押す（Enter・Space）と相性を選ぶ欄（`compatChoice`・`compat-choice-pop`。`DetailPopover` で、止まり所のマスの id に出す）：見出し「〈利用者さん〉 × 〈スタッフ〉」、`COMPAT_CHOICES` の5段（記号と `COMPAT_WORD`。未入力は「－」）、今の相性に `aria-pressed` とフォーカス（`focusSelector`）。↑↓・Home・End で動き、選ぶと `setCompatLevel` で入れて閉じ、フォーカスはマスへ。もう一度押す・Esc・外・Tab で外へ出ると閉じる
- 凡例は1か所・1行（`COMPAT_LEGEND`。記号の色はマスと同じ。札にしない）。写しが古いときだけ「表を並べ直す」

#### 吹き出し

- 列の見出し・行の名前の欄そのものが入口（ボタンを中に置かない。`aria-haspopup="dialog"`・`aria-expanded`・`aria-controls`、名前は `aria-label`）。押す・Enter・Space で `DetailPopover`（`compat-pop`。相性を選ぶ欄と合わせて開くのは1つだけ、`{ kind, id, sid }` で持つ。もう一度押すと閉じる）
- 中身は `StaffDetail`・`ClientDetail`（`compat-pop-link`・`compat-pop-counts`）。リンクでその人の画面
- 絞り込みで見出し・マスが消えたら閉じる

#### `lib/compatView.ts`（純粋関数。テストあり）

- `nameLines(name)`・`NAME_CHUNK`
- 列の絞り込み：`StaffFilterState`・`EMPTY_STAFF_FILTER`・`staffChipDefs(items)`（choice・multi は選択肢ごと、flag は あり／なし。number は作らない。キーは `staffChipKey(itemId, value)`＝それぞれ `encodeURIComponent` して「=」でつなぐ）・`staffChipMatches`（未入力はどれにも当てはまらない）・`filterStaff`（名前 AND チップ）・`staffChipCounts`・`toggleStaffChip`・`encodeStaffFilter`／`decodeStaffFilter`（知らないチップは捨てる）・`sameStaffFilter`
- 相性のチップ：`COMPAT_CHIPS`（`pending`・`ng`）・`compatChipSets`・`compatChipTests`・`compatChipText`
- 要約：`compatFilterSummary`
- 吹き出し：`staffCompatCounts`・`traitText`・`weeklyHours`

#### 機能の入り切り

- `compat` が切なら画面は開けず（予定の画面 `homePath` へ移る）、計算は相性（表の値・相性の条件・×の可否）を読まない。切るとき相性のデータがあれば管理者設定が件数と効き方の確認を出す（`turnOffImpact`）

#### 確かめ

`scripts/e2e-compat.cjs`：名前・操作の数（表にボタンが無く止まり所1つ・表の外の操作・凡例1行）・矢印で動く・選ぶ欄（印・フォーカス・選ぶと入る・Esc）・吹き出しの開閉とフォーカス・中を巻く・絞り込みと URL の復元・`?id=`・300人×60人の速さ（相性を選んで描き終わるまで。`PERF_MS_COMPAT` 既定 100ms。ならし3回のあと9回の中央値、超えたら最大3回りまで測り直し一番よい回りで比べる。マスを押して選ぶ欄が開くまでは注記）。`scripts/e2e-words.cjs`：マスの記号の意味。

#### 完了の条件

- [ ] 列の見出しの名前が切れずに出る。見出し・行の名前で詳細の吹き出しが出て、Esc・外を押す・もう一度押すで閉じ、フォーカスが見出し・名前に戻る
- [ ] 表にボタンが無く Tab の止まり所は1つ、矢印で動く。マスを押すと選ぶ欄が出て、選ぶと入り、フォーカスがマスへ戻る
- [ ] 1つの「絞り込み」の中で列（特性のチップ・名前）と行（共通の欄＋相性のチップ）を絞り込め、再読込で戻る。0人なら「絞り込みを戻す」
- [ ] `lib/compatView`・`lib/compatLevel`・`lib/gridFocus` のテストと `scripts/e2e-compat.cjs` が通る
